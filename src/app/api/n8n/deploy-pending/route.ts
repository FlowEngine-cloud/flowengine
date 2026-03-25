/**
 * POST /api/n8n/deploy-pending
 *
 * Triggers deployment for a pending_deploy instance.
 * In the portal, n8n instances are deployed via the FlowEngine API.
 * Docker instances are deployed directly if COOLIFY_API_TOKEN is configured.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient, FlowEngineApiError } from '@/lib/flowengine';
import { isValidUUID } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const body = await req.json().catch(() => ({}));
    const { instanceId, serviceType, dockerImage, dockerPort } = body;

    if (!instanceId || !isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Valid instanceId is required' }, { status: 400 });
    }
    if (!serviceType) {
      return NextResponse.json({ error: 'serviceType is required' }, { status: 400 });
    }

    // Fetch the pending instance
    const { data: instance, error: fetchError } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, invited_by_user_id, instance_name, storage_limit_gb, billing_cycle, status, service_type, platform')
      .eq('id', instanceId)
      .maybeSingle();

    if (fetchError || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Authorization check
    const isOwner = instance.user_id === effectiveUserId;
    const isManager = instance.invited_by_user_id === effectiveUserId;
    if (!isOwner && !isManager) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const deployableStatuses = ['pending_deploy', 'failed', 'stopped', 'error'];
    if (!deployableStatuses.includes(instance.status)) {
      return NextResponse.json(
        { error: `Instance cannot be deployed in state: ${instance.status}` },
        { status: 400 }
      );
    }

    // ── n8n / OpenClaw via FlowEngine API ───────────────────────────────────────────────
    if (serviceType === 'n8n' || serviceType === 'openclaw') {
      const settings = await getPortalSettings();
      const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined, settings.flowengine_api_url ?? undefined);

      if (!client) {
        return NextResponse.json(
          { error: 'FlowEngine API key not configured. Go to Settings → Connections.' },
          { status: 400 }
        );
      }

      try {
        const result = await client.createInstance({
          instance_name: instance.instance_name,
          storage_gb: instance.storage_limit_gb ?? 10,
          billing_cycle: (instance.billing_cycle as 'monthly' | 'annual') ?? 'monthly',
        });

        const provisioned = result.instance;

        // Update the local record with the FlowEngine instance info
        await supabaseAdmin
          .from('pay_per_instance_deployments')
          .update({
            status: 'provisioning',
            instance_url: provisioned.instance_url ?? null,
            platform: 'flowengine',
            service_type: serviceType,
          })
          .eq('id', instanceId);

        return NextResponse.json({ success: true, instance: { id: instanceId, ...provisioned } });
      } catch (err) {
        if (err instanceof FlowEngineApiError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }
    }

    // ── Docker via Coolify (if configured) ────────────────────────────────────
    if (serviceType === 'docker' || serviceType === 'website') {
      const coolifyToken = process.env.COOLIFY_API_TOKEN;
      const coolifyUrl = process.env.COOLIFY_API_URL;

      if (!coolifyToken || !coolifyUrl) {
        return NextResponse.json(
          { error: 'Docker deployment requires Coolify configuration. Please configure COOLIFY_API_TOKEN and COOLIFY_API_URL.' },
          { status: 400 }
        );
      }

      // Update service type in DB
      await supabaseAdmin
        .from('pay_per_instance_deployments')
        .update({ status: 'provisioning', service_type: serviceType })
        .eq('id', instanceId);

      // Store docker config for later provisioning
      if (dockerImage) {
        await supabaseAdmin
          .from('pay_per_instance_deployments')
          .update({ docker_image: dockerImage, docker_port: dockerPort ?? '3000' })
          .eq('id', instanceId);
      }

      return NextResponse.json({
        success: true,
        instance: { id: instanceId, status: 'provisioning' },
        message: 'Docker deployment initiated. Configure provisioning via Coolify.',
      });
    }

    return NextResponse.json(
      { error: `Service type '${serviceType}' is not yet supported in this portal.` },
      { status: 400 }
    );
  } catch (err) {
    console.error('[api/n8n/deploy-pending]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
