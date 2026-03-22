import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { getConnectionState } from '@/lib/evolutionApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


async function checkOwnership(instanceId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id')
    .eq('id', instanceId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

async function checkIfUserIsClient(instanceId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('client_instances')
    .select('id')
    .eq('instance_id', instanceId)
    .eq('user_id', userId)
    .maybeSingle();
  return !!data;
}

/** Map Evolution API state string to our status labels */
function evolutionStateToStatus(state: string, dbStatus: string): string {
  if (state === 'open') return 'connected';
  if (state === 'connecting') return dbStatus === 'pending_scan' ? 'pending_scan' : 'connecting';
  if (state === 'close') return 'disconnected';
  return dbStatus; // fallback to DB value if state is unrecognised
}

/**
 * GET /api/client/whatsapp-instances?instanceId=<portal-instance-uuid>
 * Returns WhatsApp numbers linked to the given portal instance with live status.
 * Accessible by the portal owner or any invited client.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId');

  if (!instanceId || !isValidUUID(instanceId)) {
    return NextResponse.json({ error: 'Invalid instanceId' }, { status: 400 });
  }

  const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

  const isOwner = await checkOwnership(instanceId, effectiveUserId);
  const isClient = !isOwner && await checkIfUserIsClient(instanceId, effectiveUserId);

  if (!isOwner && !isClient) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  const { data: rows, error } = await supabaseAdmin
    .from('whatsapp_instances')
    .select('id, instance_name, display_name, phone_number, status, webhook_url, session_token, server_url')
    .eq('linked_instance_id', instanceId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching linked WhatsApp instances:', error);
    return NextResponse.json({ error: 'Failed to fetch instances' }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ instances: [] });
  }

  // Fetch live state from Evolution API for each instance in parallel
  const instances = await Promise.all(
    rows.map(async (row) => {
      let liveStatus = row.status;

      if (row.session_token && row.server_url) {
        try {
          const result = await getConnectionState(
            { baseUrl: row.server_url, apiKey: row.session_token },
            row.instance_name
          );
          if (result.ok && result.data?.instance?.state) {
            liveStatus = evolutionStateToStatus(result.data.instance.state, row.status);
          }
        } catch {
          // Fall back to DB status on error
        }
      }

      return {
        id: row.id,
        instance_name: row.instance_name,
        display_name: row.display_name,
        phone_number: row.phone_number,
        status: liveStatus,
        webhook_url: row.webhook_url,
      };
    })
  );

  return NextResponse.json({ instances });
}
