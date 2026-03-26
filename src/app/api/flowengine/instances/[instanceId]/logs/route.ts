/**
 * Proxy: GET /api/flowengine/instances/[instanceId]/logs?lines=300
 * Fetches container logs for a FlowEngine-hosted instance.
 * Returns plain text on success, JSON error on failure.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient, FlowEngineApiError } from '@/lib/flowengine';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyFlowEngineAccess } from '@/lib/flowengineAccess';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
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
    const { authorized } = await verifyFlowEngineAccess(supabaseAdmin, user.id);
    if (!authorized) return new NextResponse('Access denied', { status: 403 });

    const { instanceId } = await params;
    const { searchParams } = new URL(req.url);
    const lines = Math.min(parseInt(searchParams.get('lines') ?? '300', 10), 1000);

    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
    if (!client) {
      return new NextResponse('[FlowEngine API key not configured — cannot fetch logs]', { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }

    const result = await client.getInstanceLogs(instanceId, lines);
    return new NextResponse(result.logs ?? '', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  } catch (err) {
    if (err instanceof FlowEngineApiError) {
      if (err.status === 404) {
        return new NextResponse('[Logs are not yet available for FlowEngine-hosted instances]', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        });
      }
      return new NextResponse(`[FlowEngine error: ${err.message}]`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
    console.error('[flowengine/instances/logs]', err);
    return new NextResponse('[Error fetching logs]', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
}
