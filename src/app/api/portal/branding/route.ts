/**
 * GET /api/portal/branding
 *
 * Returns branding for the current user:
 * - Clients:       their agency's logo + business name (looked up via client_instances.invited_by)
 * - Company users: { agency_logo_url: null, business_name: null } → UI shows FlowEngine defaults
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Check if this user is a client (has client_instances records)
    const { data: clientLinks } = await supabaseAdmin
      .from('client_instances')
      .select('invited_by')
      .eq('user_id', user.id)
      .limit(1);

    const agencyId = clientLinks?.[0]?.invited_by ?? null;

    if (!agencyId) {
      // Company user — no agency branding, frontend shows FlowEngine defaults
      return NextResponse.json({ agency_logo_url: null, business_name: null });
    }

    // Fetch the agency's branding from their profile
    const { data: agencyProfile } = await supabaseAdmin
      .from('profiles')
      .select('agency_logo_url, business_name')
      .eq('id', agencyId)
      .maybeSingle();

    return NextResponse.json({
      agency_logo_url: agencyProfile?.agency_logo_url ?? null,
      business_name: agencyProfile?.business_name ?? null,
    });
  } catch (err: any) {
    console.error('[portal/branding]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
