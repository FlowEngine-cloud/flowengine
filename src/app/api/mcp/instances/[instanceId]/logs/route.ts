/**
 * MCP API - Instance Logs
 *
 * GET /api/mcp/instances/[instanceId]/logs?lines=300
 *   Returns recent container logs for the instance.
 *   For FlowEngine instances: calls FlowEngine API.
 *   For local instances: calls local docker logs API.
 *
 * Requires: Authorization: Bearer fp_...
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/apiKeyAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient } from '@/lib/flowengine';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const userId = await validateApiKey(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Invalid or missing API key' },
      { status: 401 }
    );
  }

  const { instanceId } = await params;
  const { searchParams } = new URL(req.url);
  const lines = Math.min(parseInt(searchParams.get('lines') ?? '300', 10), 1000);

  // Check if this is a local portal instance
  const { data: localInstance } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, hosting_mode')
    .eq('id', instanceId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (localInstance) {
    // Local instance — delegate to docker logs API
    try {
      const logsRes = await fetch(
        `${req.nextUrl.origin}/api/docker/logs?instanceId=${instanceId}&lines=${lines}`,
        { headers: { 'Content-Type': 'application/json' } }
      );
      const logsText = await logsRes.text();
      return NextResponse.json({ success: true, logs: logsText });
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: 'logs_failed', message: err.message || 'Failed to fetch logs.' },
        { status: 500 }
      );
    }
  }

  // Try FlowEngine
  try {
    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
    if (!client) {
      return NextResponse.json(
        { success: false, error: 'config_error', message: 'FlowEngine API key not configured.' },
        { status: 400 }
      );
    }

    const result = await client.getInstanceLogs(instanceId, lines);
    return NextResponse.json({ success: true, logs: result.logs ?? '' });
  } catch (err: any) {
    // Instance not found on FlowEngine either
    if (err?.status === 404 || err?.code === 'not_found') {
      return NextResponse.json(
        { success: false, error: 'not_found', message: 'Instance not found.' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { success: false, error: 'logs_failed', message: err.message || 'Failed to fetch logs.' },
      { status: 500 }
    );
  }
}
