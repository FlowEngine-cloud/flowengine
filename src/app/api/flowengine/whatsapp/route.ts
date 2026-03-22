/**
 * GET /api/flowengine/whatsapp
 * Lists WhatsApp sessions from FlowEngine API (uses saved API key from portal settings).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient } from '@/lib/flowengine';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
    if (!client) return NextResponse.json({ sessions: [] });

    const sessions = await client.listWhatsAppSessions();
    return NextResponse.json({ success: true, sessions });
  } catch {
    return NextResponse.json({ sessions: [] });
  }
}
