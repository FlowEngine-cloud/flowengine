/**
 * POST /api/docker/manage
 * Start, stop, restart, or redeploy a Docker/website instance.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

const VALID_ACTIONS = ['start', 'stop', 'restart', 'redeploy'] as const;
type Action = typeof VALID_ACTIONS[number];

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { instanceId, action } = body;

    if (!instanceId || !isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Valid instanceId is required' }, { status: 400 });
    }
    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json({ error: `action must be one of: ${VALID_ACTIONS.join(', ')}` }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, invited_by_user_id, status, coolify_service_id')
      .eq('id', instanceId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const isOwner = instance.user_id === effectiveUserId;
    const isManager = instance.invited_by_user_id === effectiveUserId;
    if (!isOwner && !isManager) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const coolifyToken = process.env.COOLIFY_API_TOKEN;
    const coolifyUrl = process.env.COOLIFY_API_URL;

    if (!coolifyToken || !coolifyUrl) {
      return NextResponse.json(
        { error: 'Docker instance management requires Coolify configuration.' },
        { status: 400 }
      );
    }

    if (!instance.coolify_service_id) {
      return NextResponse.json(
        { error: 'Instance has no Coolify service ID. Re-deploy the instance first.' },
        { status: 400 }
      );
    }

    // Map action to Coolify endpoint
    const coolifyAction = action === 'redeploy' ? 'deploy' : action;
    const res = await fetch(
      `${coolifyUrl}/api/v1/services/${instance.coolify_service_id}/${coolifyAction}`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${coolifyToken}`, 'Content-Type': 'application/json' },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: `Coolify error: ${text}` }, { status: res.status });
    }

    // Update local status optimistically
    const optimisticStatus = action === 'stop' ? 'stopped' : 'provisioning';
    await supabaseAdmin
      .from('pay_per_instance_deployments')
      .update({ status: optimisticStatus })
      .eq('id', instanceId);

    return NextResponse.json({ success: true, message: `${action} initiated` });
  } catch (err) {
    console.error('[api/docker/manage]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
