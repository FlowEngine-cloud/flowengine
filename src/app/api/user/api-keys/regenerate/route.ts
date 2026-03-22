import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { randomBytes, createHash } from 'crypto';

export async function POST() {
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

    const apiKey = 'fp_' + randomBytes(32).toString('hex');
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    const keyPrefix = apiKey.substring(0, 10) + '...';

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error } = await supabaseAdmin
      .from('api_key')
      .upsert(
        { user_id: user.id, key_hash: keyHash, key_prefix: keyPrefix, created_at: new Date().toISOString(), last_used_at: null },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('[API:REGENERATE]', error);
      return NextResponse.json({ success: false, message: 'Failed to generate API key' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      api_key: apiKey,
      key_prefix: keyPrefix,
      message: 'API key generated successfully',
    });

  } catch (error) {
    console.error('[API:REGENERATE]', error);
    return NextResponse.json({ success: false, message: 'Internal server error' }, { status: 500 });
  }
}
