/**
 * GET /api/flowengine/whatsapp
 * Lists WhatsApp sessions from FlowEngine API (uses saved API key from portal settings).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient } from '@/lib/flowengine';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { verifyFlowEngineAccess } from '@/lib/flowengineAccess';

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { authorized } = await verifyFlowEngineAccess(supabaseAdmin, user.id);
    if (!authorized) return NextResponse.json({ error: 'Access denied' }, { status: 403 });

    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined);
    if (!client) return NextResponse.json({ sessions: [] });

    const sessions = await client.listWhatsAppSessions();
    return NextResponse.json({ success: true, sessions });
  } catch (err) {
    const msg = (err as Error)?.message || String(err);
    console.error('[flowengine/whatsapp] Error:', msg);
    return NextResponse.json({ error: 'Failed to fetch WhatsApp sessions', sessions: [] }, { status: 500 });
  }
}
