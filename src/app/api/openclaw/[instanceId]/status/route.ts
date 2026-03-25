/**
 * GET /api/openclaw/[instanceId]/status
 * Returns instance data from Supabase for the portal.
 * Unlike the FlowEngine version, this does not poll Coolify — it returns DB status only.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { isValidUUID } from '@/lib/validation';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params;

  if (!isValidUUID(instanceId)) {
    return NextResponse.json({ error: 'Invalid instance ID' }, { status: 400 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

  const { data: instance, error } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_name, instance_url, status, openclaw_primary_model, openclaw_channel_tokens, gateway_token, service_type')
    .eq('id', instanceId)
    .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
    .maybeSingle();

  if (error || !instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  return NextResponse.json({ instance, containerStatus: instance.status });
}
