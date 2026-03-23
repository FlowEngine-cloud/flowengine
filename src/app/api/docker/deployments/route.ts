/**
 * GET /api/docker/deployments?instanceId=...
 * Returns deployment history for a Docker/website instance.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

export async function GET(req: NextRequest) {
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

    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId');

    if (!instanceId || !isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Valid instanceId is required' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, invited_by_user_id, coolify_service_id')
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

    if (!coolifyToken || !coolifyUrl || !instance.coolify_service_id) {
      return NextResponse.json({ deployments: [] });
    }

    const res = await fetch(
      `${coolifyUrl}/api/v1/services/${instance.coolify_service_id}/deployments`,
      { headers: { Authorization: `Bearer ${coolifyToken}`, 'Content-Type': 'application/json' } }
    );

    if (!res.ok) {
      return NextResponse.json({ deployments: [] });
    }

    const data = await res.json();
    const deployments = Array.isArray(data) ? data : (data.deployments ?? []);
    return NextResponse.json({ deployments });
  } catch (err) {
    console.error('[api/docker/deployments]', err);
    return NextResponse.json({ deployments: [] });
  }
}
