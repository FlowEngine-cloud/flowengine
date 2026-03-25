import { NextRequest, NextResponse } from 'next/server';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient } from '@/lib/flowengine';
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

// GET /api/flowengine/whatsapp/[instanceName] — get session details (includes qr_code)
export async function GET(req: NextRequest, { params }: { params: Promise<{ instanceName: string }> }) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { authorized } = await verifyFlowEngineAccess(supabaseAdmin, user.id);
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { instanceName } = await params;
    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined, settings.flowengine_api_url ?? undefined);
    if (!client) return NextResponse.json({ error: 'FlowEngine API key not configured' }, { status: 400 });

    const session = await client.getWhatsAppSession(instanceName);
    return NextResponse.json({ success: true, session });
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PUT /api/flowengine/whatsapp/[instanceName] — set webhook URL
export async function PUT(req: NextRequest, { params }: { params: Promise<{ instanceName: string }> }) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { authorized } = await verifyFlowEngineAccess(supabaseAdmin, user.id);
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const { instanceName } = await params;
    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined, settings.flowengine_api_url ?? undefined);
    if (!client) return NextResponse.json({ error: 'FlowEngine API key not configured' }, { status: 400 });

    const body = await req.json();
    const webhookUrl: string = body.webhook_url ?? '';
    await client.setWhatsAppWebhook(instanceName, webhookUrl);
    return NextResponse.json({ success: true });
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
