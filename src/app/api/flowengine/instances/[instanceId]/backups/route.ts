/**
 * Proxy: GET + POST /api/flowengine/instances/[instanceId]/backups
 * Lists and creates backups for a FlowEngine-hosted n8n instance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient, FlowEngineApiError } from '@/lib/flowengine';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyFlowEngineAccess } from '@/lib/flowengineAccess';

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

function handleError(err: unknown) {
  if (err instanceof FlowEngineApiError) {
    return NextResponse.json(
      { success: false, error: err.code, message: err.message },
      { status: err.status }
    );
  }
  const msg = (err as Error)?.message || String(err);
  console.error('[flowengine/instances/backups] Error:', msg);
  return NextResponse.json(
    { success: false, error: 'internal_error', message: 'An unexpected error occurred.' },
    { status: 500 }
  );
}

// GET — list backups
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { authorized } = await verifyFlowEngineAccess(supabaseAdmin, user.id);
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { instanceId } = await params;
    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
    if (!client) return NextResponse.json({ error: 'FlowEngine API key not configured' }, { status: 400 });

    const result = await client.listBackups(instanceId);
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}

// POST — create backup
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { authorized } = await verifyFlowEngineAccess(supabaseAdmin, user.id);
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { instanceId } = await params;
    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
    if (!client) return NextResponse.json({ error: 'FlowEngine API key not configured' }, { status: 400 });

    const result = await client.createBackup(instanceId);
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}
