/**
 * GET /api/openclaw/[instanceId]/status
 * Returns instance data from Supabase for the portal.
 * Handles three access patterns:
 *   1. Agency owner / invited manager (user_id or invited_by_user_id match)
 *   2. Client user (via client_instances table)
 *   3. FlowEngine-hosted instance (auto-upsert from FE API on first access)
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { isValidUUID } from '@/lib/validation';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient } from '@/lib/flowengine';

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

  // 1. Check agency ownership / manager access
  const { data: instance, error } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_name, instance_url, status, openclaw_primary_model, openclaw_channel_tokens, gateway_token, service_type')
    .eq('id', instanceId)
    .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
    .maybeSingle();

  if (!error && instance) {
    return NextResponse.json({ instance, containerStatus: instance.status });
  }

  // 2. Check client access (instance shared with this user)
  const { data: clientAccess } = await supabaseAdmin
    .from('client_instances')
    .select('instance_id, pay_per_instance_deployments(id, instance_name, instance_url, status, openclaw_primary_model, openclaw_channel_tokens, gateway_token, service_type)')
    .eq('instance_id', instanceId)
    .eq('user_id', user.id)
    .maybeSingle();

  const clientInst = (clientAccess as any)?.pay_per_instance_deployments;
  if (clientInst && !clientInst.deleted_at) {
    return NextResponse.json({ instance: clientInst, containerStatus: clientInst.status });
  }

  // 3. FlowEngine-hosted instance — auto-upsert from FE API on first access
  try {
    const settings = await getPortalSettings();
    if (settings.flowengine_api_key) {
      const feClient = createFlowEngineClient(settings.flowengine_api_key);
      const feInstance = await feClient.getInstance(instanceId).catch(() => null);
      if (feInstance && !feInstance.is_external) {
        await supabaseAdmin.from('pay_per_instance_deployments').upsert({
          id: instanceId,
          user_id: effectiveUserId,
          instance_name: feInstance.instance_name,
          instance_url: feInstance.instance_url,
          status: feInstance.status,
          service_type: 'openclaw',
          is_external: false,
          hosting_mode: 'cloud',
          storage_limit_gb: feInstance.storage_gb || 10,
        }, { onConflict: 'id' });

        return NextResponse.json({
          instance: {
            id: instanceId,
            instance_name: feInstance.instance_name,
            instance_url: feInstance.instance_url,
            status: feInstance.status,
            openclaw_primary_model: null,
            openclaw_channel_tokens: null,
            gateway_token: null,
            service_type: 'openclaw',
          },
          containerStatus: feInstance.status,
        });
      }
    }
  } catch {
    // FlowEngine API unavailable — fall through to 404
  }

  return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
}
