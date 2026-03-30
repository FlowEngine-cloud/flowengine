/**
 * FlowEngine Instance Provisioning Proxy
 *
 * POST /api/flowengine/instances - Provision via FlowEngine API
 * GET  /api/flowengine/instances - List instances from FlowEngine
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortalSettings, invalidateSettingsCache } from '@/lib/portalSettings';
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


function handleError(err: unknown) {
  // Structured FlowEngine API errors — forward status, code, and message as-is
  if (err instanceof FlowEngineApiError) {
    console.error(`[flowengine/instances] ${err.status} ${err.code}: ${err.message}`);
    return NextResponse.json(
      { success: false, error: err.code, message: err.message },
      { status: err.status }
    );
  }

  const msg = (err as Error)?.message || String(err);
  console.error('[flowengine/instances] Error:', msg);

  if (msg.includes('AbortError') || msg.includes('abort') || msg.includes('timeout')) {
    return NextResponse.json(
      { success: false, error: 'timeout', message: 'FlowEngine API timed out. The instance may still be provisioning — check your dashboard.' },
      { status: 504 }
    );
  }
  if (msg.includes('fetch failed') || msg.includes('ECONNREFUSED') || msg.includes('ENOTFOUND')) {
    return NextResponse.json(
      { success: false, error: 'unreachable', message: 'Could not reach FlowEngine. Please try again.' },
      { status: 502 }
    );
  }

  return NextResponse.json(
    { success: false, error: 'internal_error', message: 'An unexpected error occurred. Please try again.' },
    { status: 500 }
  );
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { authorized, role } = await verifyFlowEngineAccess(supabaseAdmin, user.id);
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    if (!canWrite(role)) return NextResponse.json({ error: 'Your role does not allow deploying instances' }, { status: 403 });

    invalidateSettingsCache();
    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
    if (!client) {
      return NextResponse.json({ error: 'FlowEngine API key not configured. Go to Settings → Connections.' }, { status: 400 });
    }

    const body = await req.json();
    const { instanceName, storageSize, billingCycle } = body;

    if (!instanceName?.trim()) {
      return NextResponse.json({ error: 'Instance name is required' }, { status: 400 });
    }
    if (![10, 30, 50].includes(storageSize)) {
      return NextResponse.json({ error: 'Invalid storage size. Must be 10, 30, or 50.' }, { status: 400 });
    }
    if (!['monthly', 'annual'].includes(billingCycle)) {
      return NextResponse.json({ error: 'Invalid billing cycle.' }, { status: 400 });
    }

    const result = await client.createInstance({
      instance_name: instanceName.trim(),
      storage_gb: storageSize,
      billing_cycle: billingCycle,
    });

    return NextResponse.json({ success: true, instance: result.instance || result }, { status: 201 });
  } catch (err) {
    return handleError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { authorized } = await verifyFlowEngineAccess(supabaseAdmin, user.id);
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    invalidateSettingsCache();
    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
    if (!client) {
      return NextResponse.json({ error: 'FlowEngine API key not configured' }, { status: 400 });
    }

    const instances = await client.listInstances();
    return NextResponse.json({ success: true, instances });
  } catch (err) {
    return handleError(err);
  }
}
