import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            const cookie = cookieStore.get(name);
            return cookie?.value;
          },
          set(name: string, value: string, options: any) {
            cookieStore.set({ name, value, ...(options as object) });
          },
          remove(name: string, options: any) {
            cookieStore.delete({ name, ...(options as object) });
          },
        },
      }
    );

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user settings with proper headers
    const { data: settings, error } = await supabase
      .from('user_settings')
      .select('claude_api_key, openai_api_key, preferred_model')
      .eq('user_id', session.user.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching user settings:', error);
      return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
    }

    // Return default settings if no settings found
    const userSettings = settings || {
      claude_api_key: null,
      openai_api_key: null,
      preferred_model: 'claude',
    };

    return NextResponse.json(userSettings, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error) {
    console.error('Error in user settings API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
