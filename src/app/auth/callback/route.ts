import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { CookieOptions } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  // Use configured production URL when available to avoid localhost fallback in some edge runtimes
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || origin;
  const code = searchParams.get('code');
  // If "next" or "redirect" is in the params, use it as the redirect URL
  // Validate to prevent open redirect — must start with "/" and not "//" (protocol-relative)
  const rawNext = searchParams.get('next') ?? searchParams.get('redirect') ?? '/portal';
  const next = (rawNext.startsWith('/') && !rawNext.startsWith('//')) ? rawNext : '/portal';

  if (code) {
    // Create the server-side client from the new SSR library
    const supabase = createServerClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          async get(name: string) {
            return (await cookies()).get(name)?.value;
          },
          async set(name: string, value: string, options: CookieOptions) {
            try {
              (await cookies()).set({ name, value, ...options });
            } catch (error) {
              console.error('Error setting cookie:', error);
            }
          },
          async remove(name: string, options: CookieOptions) {
            try {
              (await cookies()).delete({ name, ...options });
            } catch (error) {
              console.error('Error removing cookie:', error);
            }
          },
        },
      }
    );

    // Exchange the code for a session
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if this is a new user and trigger provisioning
      const { data: { user } } = await supabase.auth.getUser();

      if (user && user.email) {
        // Ensure profiles.email is always in sync with auth.users.email
        const serviceSupabase = (await import('@supabase/supabase-js')).createClient(
          process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        await serviceSupabase
          .from('profiles')
          .update({ email: user.email, full_name: user.user_metadata?.full_name || user.user_metadata?.name || null })
          .eq('id', user.id);

        // Check if this is a new user (just signed up)
        const userCreatedAt = user.created_at ? new Date(user.created_at) : null;
        const now = new Date();
        const ageInSeconds = userCreatedAt ? (now.getTime() - userCreatedAt.getTime()) / 1000 : 0;
        const isNewUser = userCreatedAt && ageInSeconds < 60;

        console.log('👤 User auth callback:', {
          email: user.email,
          userId: user.id,
          createdAt: userCreatedAt?.toISOString(),
          ageInSeconds: Math.round(ageInSeconds),
          isNewUser
        });

        if (isNewUser) {
          console.log('🚀 New user detected, triggering background provisioning for:', user.email);
        }
      }

      // On success, redirect to the intended page or homepage
      return NextResponse.redirect(`${baseUrl}${next}`);
    }

    console.error('Auth exchange error:', error);
  }

  // On failure, redirect to an error page
  console.error('Authentication failed: Redirecting to auth error page.');
  return NextResponse.redirect(`${baseUrl}/auth/auth-code-error`);
}
