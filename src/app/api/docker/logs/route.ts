/**
 * GET /api/docker/logs?instanceId=...&lines=300
 * Fetch container logs from Coolify.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId');
    const lines = Math.min(parseInt(searchParams.get('lines') ?? '300', 10), 1000);

    if (!instanceId || !isValidUUID(instanceId)) {
      return new NextResponse('Valid instanceId is required', { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, invited_by_user_id, coolify_service_id')
      .eq('id', instanceId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!instance) {
      return new NextResponse('Instance not found', { status: 404 });
    }

    const isOwner = instance.user_id === effectiveUserId;
    const isManager = instance.invited_by_user_id === effectiveUserId;
    if (!isOwner && !isManager) {
      return new NextResponse('Access denied', { status: 403 });
    }

    const coolifyToken = process.env.COOLIFY_API_TOKEN;
    const coolifyUrl = process.env.COOLIFY_API_URL;

    if (!coolifyToken || !coolifyUrl) {
      return new NextResponse(
        '[Logs unavailable: Coolify is not configured for this portal instance]',
        { status: 200 }
      );
    }

    if (!instance.coolify_service_id) {
      return new NextResponse('[No Coolify service ID found for this instance]', { status: 200 });
    }

    const res = await fetch(
      `${coolifyUrl}/api/v1/services/${instance.coolify_service_id}/logs?lines=${lines}`,
      { headers: { Authorization: `Bearer ${coolifyToken}` } }
    );

    if (!res.ok) {
      return new NextResponse(`[Could not fetch logs: HTTP ${res.status}]`, { status: 200 });
    }

    const data = await res.json();
    const logText = Array.isArray(data.logs) ? data.logs.join('\n') : (data.logs ?? data ?? '');
    return new NextResponse(logText, {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err) {
    console.error('[api/docker/logs]', err);
    return new NextResponse('[Error fetching logs]', { status: 200 });
  }
}
