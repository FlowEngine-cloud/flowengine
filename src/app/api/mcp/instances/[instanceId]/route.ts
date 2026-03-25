/**
 * MCP API - Instance Detail Management
 *
 * GET    /api/mcp/instances/[instanceId]  — get instance status
 * POST   /api/mcp/instances/[instanceId]  — manage instance (start/stop/restart)
 * PATCH  /api/mcp/instances/[instanceId]  — update instance config (name)
 *
 * Requires: Authorization: Bearer fp_...
 * Supports both local portal instances and FlowEngine-hosted instances.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/apiKeyAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient } from '@/lib/flowengine';

async function resolveInstance(userId: string, instanceId: string) {
  // Check local portal instances first
  const { data: local } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_name, instance_url, status, hosting_mode, service_type, storage_limit_gb, created_at, updated_at, coolify_service_id')
    .eq('id', instanceId)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (local) return { instance: local, platform: 'local' as const };

  // Try FlowEngine
  try {
    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
    if (client) {
      const feInstance = await client.getInstance(instanceId);
      if (feInstance) return { instance: feInstance, platform: 'flowengine' as const, client };
    }
  } catch { /* not found on FlowEngine either */ }

  return null;
}

// GET — instance status
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
  const resolved = await resolveInstance(userId, instanceId);

  if (!resolved) {
    return NextResponse.json(
      { success: false, error: 'not_found', message: 'Instance not found.' },
      { status: 404 }
    );
  }

  return NextResponse.json({
    success: true,
    instance: resolved.instance,
    platform: resolved.platform,
  });
}

// POST — manage instance (start/stop/restart)
export async function POST(
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
  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  if (!['start', 'stop', 'restart'].includes(action)) {
    return NextResponse.json(
      { success: false, error: 'invalid_action', message: 'action must be one of: start, stop, restart' },
      { status: 400 }
    );
  }

  const resolved = await resolveInstance(userId, instanceId);

  if (!resolved) {
    return NextResponse.json(
      { success: false, error: 'not_found', message: 'Instance not found.' },
      { status: 404 }
    );
  }

  if (resolved.platform === 'flowengine') {
    try {
      const settings = await getPortalSettings();
      const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
      if (!client) {
        return NextResponse.json(
          { success: false, error: 'config_error', message: 'FlowEngine API key not configured.' },
          { status: 400 }
        );
      }
      const result = await client.manageInstance(instanceId, action as 'start' | 'stop' | 'restart');
      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: 'manage_failed', message: err.message || 'Failed to manage instance.' },
        { status: 500 }
      );
    }
  }

  // Local instance — call local docker manage
  try {
    const res = await fetch(`${req.nextUrl.origin}/api/docker/manage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instanceId, action }),
    });
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: 'manage_failed', message: err.message || 'Failed to manage instance.' },
      { status: 500 }
    );
  }
}

// PATCH — update instance config (name)
export async function PATCH(
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
  const body = await req.json().catch(() => ({}));
  const newName = typeof body?.instance_name === 'string' ? body.instance_name.trim().substring(0, 50) : '';

  if (!newName) {
    return NextResponse.json(
      { success: false, error: 'invalid_name', message: 'instance_name is required.' },
      { status: 400 }
    );
  }

  const resolved = await resolveInstance(userId, instanceId);

  if (!resolved) {
    return NextResponse.json(
      { success: false, error: 'not_found', message: 'Instance not found.' },
      { status: 404 }
    );
  }

  if (resolved.platform === 'flowengine') {
    try {
      const settings = await getPortalSettings();
      const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
      if (!client) {
        return NextResponse.json(
          { success: false, error: 'config_error', message: 'FlowEngine API key not configured.' },
          { status: 400 }
        );
      }
      const result = await client.renameInstance(instanceId, newName);
      return NextResponse.json(result);
    } catch (err: any) {
      return NextResponse.json(
        { success: false, error: 'rename_failed', message: err.message || 'Failed to rename instance.' },
        { status: 500 }
      );
    }
  }

  // Local instance — update in DB
  const { error } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .update({ instance_name: newName, updated_at: new Date().toISOString() })
    .eq('id', instanceId)
    .eq('user_id', userId)
    .is('deleted_at', null);

  if (error) {
    return NextResponse.json(
      { success: false, error: 'db_error', message: 'Failed to rename instance.' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, instance_name: newName });
}
