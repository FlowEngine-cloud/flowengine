/**
 * GET /api/docker/status?instanceId=...
 * Returns the live status of a Docker/website instance.
 * Queries Coolify if configured, otherwise falls back to DB status.
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

    // If Coolify is configured and we have a service ID, query live status
    const coolifyToken = process.env.COOLIFY_API_TOKEN;
    const coolifyUrl = process.env.COOLIFY_API_URL;

    if (coolifyToken && coolifyUrl && instance.coolify_service_id) {
      try {
        const res = await fetch(`${coolifyUrl}/api/v1/services/${instance.coolify_service_id}`, {
          headers: { Authorization: `Bearer ${coolifyToken}`, 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          const data = await res.json();
          const rawStatus = data.status ?? data.Status ?? 'unknown';
          const containerStatus = mapCoolifyStatus(rawStatus);
          return NextResponse.json({ containerStatus, raw: rawStatus });
        }
      } catch {
        // Fall through to DB status
      }
    }

    // Fallback: return DB status
    return NextResponse.json({ containerStatus: instance.status ?? 'unknown' });
  } catch (err) {
    console.error('[api/docker/status]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function mapCoolifyStatus(raw: string): string {
  const s = (raw ?? '').toLowerCase();
  if (s.includes('running')) return 'running';
  if (s.includes('exited') || s.includes('stopped')) return 'stopped';
  if (s.includes('error') || s.includes('fail')) return 'error';
  if (s.includes('start')) return 'starting';
  if (s.includes('restart')) return 'restarting';
  if (s.includes('provid') || s.includes('deploy') || s.includes('build')) return 'provisioning';
  return raw;
}
