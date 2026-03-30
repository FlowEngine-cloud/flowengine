import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Simplified Signup Completion Flow
 *
 * This endpoint is called after a user has been created in Supabase Auth.
 * Database triggers now handle all provisioning automatically.
 * This route only ensures the user profile exists.
 */
export async function POST(request: NextRequest) {
  console.log('[/api/auth/signup-complete] Received request.');

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
  );

  // 1. Get the newly signed-up user
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error('[/api/auth/signup-complete] Authentication error:', authError);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  console.log(`[/api/auth/signup-complete] Authenticated user: ${user.id}`);

  // 2. Ensure the user's profile exists (triggers will handle provisioning)
  const serviceClient = createServerClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { get: () => undefined } }
  );

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('[/api/auth/signup-complete] Error fetching profile:', profileError);
  }

  if (!profile) {
    console.log(`[/api/auth/signup-complete] Profile not found for user ${user.id}. Creating one.`);
    const { error: insertError } = await serviceClient.from('profiles').insert({
      id: user.id,
      email: user.email,
    });

    if (insertError) {
      console.error('[/api/auth/signup-complete] Failed to create profile:', insertError);
      return NextResponse.json({ error: 'Failed to initialize user profile.' }, { status: 500 });
    }
  }

  // 3. Return success - database triggers handle all provisioning
  console.log('[/api/auth/signup-complete] Profile ensured. Database triggers will handle provisioning.');
  return NextResponse.json({
    success: true,
    message: 'Signup complete. Account provisioning handled by database triggers.',
  });
}
