import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

/**
 * GET /api/agency/external-instances
 * Returns external pay-per-instance deployments accessible by the effective user
 * (owner or team member acting on behalf of owner).
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
      .from('pay_per_instance_deployments')
      .select('id, instance_name, instance_url, service_type')
      .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
      .eq('is_external', true)
      .is('deleted_at', null)
      .neq('subscription_status', 'canceled');

    if (error) {
      console.error('Failed to fetch agency external instances:', error);
      return NextResponse.json({ error: 'Failed to fetch external instances' }, { status: 500 });
    }

    const instances = (data || []).map((i: { id: string; instance_name: string; instance_url: string | null; service_type: string | null }) => ({
      id: i.id,
      name: i.instance_name,
      url: i.instance_url,
      service_type: i.service_type,
    }));

    return NextResponse.json({ instances });
  } catch (error) {
    console.error('Agency external instances error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
