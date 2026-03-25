/**
 * Proxy: GET + DELETE /api/flowengine/instances/[instanceId]
 * Forwards to FlowEngine public API v1 using the portal's saved API key.
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
  console.error('[flowengine/instances/[instanceId]] Error:', msg);
  return NextResponse.json(
    { success: false, error: 'internal_error', message: 'An unexpected error occurred.' },
    { status: 500 }
  );
}

// GET — fetch instance details with live status
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
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined, settings.flowengine_api_url ?? undefined);
    if (!client) return NextResponse.json({ error: 'FlowEngine API key not configured' }, { status: 400 });

    const instance = await client.getInstance(instanceId);
    return NextResponse.json({ success: true, instance });
  } catch (err) {
    return handleError(err);
  }
}

// PATCH — rename instance
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { authorized } = await verifyFlowEngineAccess(supabaseAdmin, user.id);
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { instanceId } = await params;
    const body = await req.json().catch(() => ({}));
    const { instance_name } = body;

    if (!instance_name || typeof instance_name !== 'string' || !instance_name.trim()) {
      return NextResponse.json({ error: 'instance_name is required' }, { status: 400 });
    }

    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined, settings.flowengine_api_url ?? undefined);
    if (!client) return NextResponse.json({ error: 'FlowEngine API key not configured' }, { status: 400 });

    const result = await client.renameInstance(instanceId, instance_name.trim().substring(0, 50));
    return NextResponse.json(result);
  } catch (err) {
    return handleError(err);
  }
}

// DELETE — cancel subscription and delete instance
export async function DELETE(
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
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined, settings.flowengine_api_url ?? undefined);
    if (!client) return NextResponse.json({ error: 'FlowEngine API key not configured' }, { status: 400 });

    await client.deleteInstance(instanceId);
    return NextResponse.json({ success: true, message: 'Instance deleted.' });
  } catch (err) {
    return handleError(err);
  }
}
