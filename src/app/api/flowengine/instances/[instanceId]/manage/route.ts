/**
 * Proxy: POST /api/flowengine/instances/[instanceId]/manage
 * Forwards start/stop/restart actions to FlowEngine public API v1.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient, FlowEngineApiError } from '@/lib/flowengine';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyFlowEngineAccess } from '@/lib/flowengineAccess';
import { canWrite } from '@/lib/teamUtils';

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { authorized, role } = await verifyFlowEngineAccess(supabaseAdmin, user.id);
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    if (!canWrite(role)) return NextResponse.json({ error: 'Your role does not allow managing instances' }, { status: 403 });

    const { instanceId } = await params;

    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch {}

    const action = body.action as string;
    if (!['start', 'stop', 'restart'].includes(action)) {
      return NextResponse.json(
        { success: false, error: 'invalid_action', message: 'action must be "start", "stop", or "restart".' },
        { status: 400 }
      );
    }

    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
    if (!client) return NextResponse.json({ error: 'FlowEngine API key not configured' }, { status: 400 });

    const result = await client.manageInstance(instanceId, action as 'start' | 'stop' | 'restart');
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FlowEngineApiError) {
      return NextResponse.json(
        { success: false, error: err.code, message: err.message },
        { status: err.status }
      );
    }
    const msg = (err as Error)?.message || String(err);
    console.error('[flowengine/instances/manage] Error:', msg);
    return NextResponse.json(
      { success: false, error: 'internal_error', message: 'An unexpected error occurred.' },
      { status: 500 }
    );
  }
}
