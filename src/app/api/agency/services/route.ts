import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

/**
 * GET /api/agency/services
 * Returns WhatsApp service instances owned by the effective user (owner or team member acting on behalf of owner).
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const { data, error } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, display_name, instance_name, phone_number')
      .eq('user_id', effectiveUserId)
      .is('deleted_at', null)
      .in('status', ['connected', 'pending_scan', 'connecting']);

    if (error) {
      console.error('Failed to fetch agency services:', error);
      return NextResponse.json({ error: 'Failed to fetch services' }, { status: 500 });
    }

    const services = (data || []).map((s: { id: string; display_name: string | null; instance_name: string; phone_number: string | null }) => ({
      id: s.id,
      name: s.display_name || s.instance_name,
      phone: s.phone_number,
    }));

    return NextResponse.json({ services });
  } catch (error) {
    console.error('Agency services error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
