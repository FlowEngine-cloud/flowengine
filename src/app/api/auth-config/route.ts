import { NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

let _client: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}

/**
 * Public endpoint — returns only auth-related settings for the login page.
 * No authentication required (the login page needs these before the user is signed in).
 */
export async function GET() {
  try {
    const sb = getSupabaseAdmin();

    const [{ data }, { data: profile }, { count }] = await Promise.all([
      sb.from('portal_settings')
        .select('allow_signup, enable_google_auth, enable_linkedin_auth, enable_github_auth')
        .limit(1)
        .single(),
      sb.from('profiles')
        .select('business_name')
        .not('business_name', 'is', null)
        .limit(1)
        .single(),
      sb.from('profiles').select('id', { count: 'exact', head: true }),
    ]);

    const firstRun = (count ?? 0) === 0;

    return NextResponse.json({
      allow_signup: firstRun || (data?.allow_signup ?? false),
      enable_google_auth: data?.enable_google_auth ?? false,
      enable_linkedin_auth: data?.enable_linkedin_auth ?? false,
      enable_github_auth: data?.enable_github_auth ?? false,
      agency_name: profile?.business_name || null,
      first_run: firstRun,
    });
  } catch {
    // Default: everything disabled
    return NextResponse.json({
      allow_signup: false,
      enable_google_auth: false,
      enable_linkedin_auth: false,
      enable_github_auth: false,
      agency_name: null,
      first_run: false,
    });
  }
}
