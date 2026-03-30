import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: any) {
            try { cookieStore.set({ name, value, ...options }); } catch {}
          },
          remove(name: string, options: any) {
            try { cookieStore.delete({ name, ...options }); } catch {}
          },
        },
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, message: 'Authentication required' }, { status: 401 });
    }

    const { data: apiKeyData } = await supabase
      .from('api_key')
      .select('key_prefix, last_used_at, created_at')
      .eq('user_id', user.id)
      .single();

    if (!apiKeyData) {
      return NextResponse.json({ success: true, hasKey: false });
    }

    return NextResponse.json({
      success: true,
      hasKey: true,
      key_prefix: apiKeyData.key_prefix,
      last_used_at: apiKeyData.last_used_at,
      created_at: apiKeyData.created_at,
    });

  } catch (error) {
    console.error('[API:KEY:INFO]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
