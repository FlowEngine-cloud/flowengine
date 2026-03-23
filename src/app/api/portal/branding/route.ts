import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const authHeader = request.headers.get('Authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ agency_logo_url: null });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ agency_logo_url: null });

  // Check if this user is a client — if so, fetch agency's branding
  const { data: clientLink } = await supabaseAdmin
    .from('client_instances')
    .select('invited_by')
    .eq('user_id', user.id)
    .limit(1)
    .single();

  const profileId = clientLink?.invited_by ?? user.id;

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('agency_logo_url')
    .eq('id', profileId)
    .single();

  return NextResponse.json({ agency_logo_url: profile?.agency_logo_url ?? null });
}
