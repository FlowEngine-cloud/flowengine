/**
 * GET /api/n8n/status?instanceId=...
 * Returns the live status of an n8n instance.
 * Queries the n8n health endpoint if instance_url and n8n_api_key are available,
 * otherwise falls back to stored DB status.
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
      .select('id, user_id, invited_by_user_id, instance_url, n8n_api_key, status, is_external')
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

    // If instance_url and n8n_api_key are available, query live health
    if (instance.instance_url && instance.n8n_api_key) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        const res = await fetch(`${instance.instance_url}/rest/health`, {
          headers: { 'x-n8n-api-key': instance.n8n_api_key },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (res.status === 401 || res.status === 403) {
          // API key may have changed — fall through to DB status
        } else if (res.ok) {
          const body = await res.json();
          if (body?.status === 'ok') {
            return NextResponse.json({ status: 'running' });
          }
        }
      } catch {
        // Request failed or timed out — fall through to DB status
      }
    }

    // Fallback: return stored DB status
    return NextResponse.json({ status: instance.status ?? 'unknown' });
  } catch (err) {
    console.error('[api/n8n/status]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
