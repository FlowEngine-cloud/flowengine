import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { fetchN8nExecutions } from '@/lib/n8nInstanceApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET: List recent executions for client's instance
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Check for preview mode
    const { searchParams } = new URL(req.url);
    const previewInstanceId = searchParams.get('preview');

    let instanceId: string;

    // Preview mode: Agency owner or manager previewing
    if (previewInstanceId && isValidUUID(previewInstanceId)) {
      // Verify user owns or manages this instance (non-deleted) and get instance details
      const { data: ownedInstance } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, instance_url, n8n_api_key')
        .eq('id', previewInstanceId)
        .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
        .is('deleted_at', null)
        .maybeSingle();

      if (!ownedInstance) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      instanceId = previewInstanceId;
      const instanceDetails = ownedInstance;

      if (!instanceDetails?.instance_url || !instanceDetails?.n8n_api_key) {
        return NextResponse.json({ executions: [] });
      }

      // Fetch recent executions from n8n using helper (handles SSL bypass)
      const result = await fetchN8nExecutions(instanceDetails.instance_url, instanceDetails.n8n_api_key, 20);

      if (result.error) {
        console.error('n8n fetch error:', result.error);
        return NextResponse.json({ executions: [], error: result.error });
      }

      return NextResponse.json({ executions: result.executions });
    }

    // Normal client mode - check BOTH sources with individual error handling:
    // 1. client_instances (agency-owned instances)
    // 2. pay_per_instance_deployments with invited_by_user_id (client-owned instances)
    let clientInstanceRecords: any[] | null = null;
    let clientOwnedInstances: any[] | null = null;

    try {
      const { data } = await supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('user_id', effectiveUserId);
      clientInstanceRecords = data;
    } catch (error) {
      console.error('Failed to fetch client instance records:', error);
      clientInstanceRecords = [];
    }

    try {
      const { data } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id')
        .eq('user_id', effectiveUserId)
        .not('invited_by_user_id', 'is', null)
        .is('deleted_at', null);
      clientOwnedInstances = data;
    } catch (error) {
      console.error('Failed to fetch client-owned instances:', error);
      clientOwnedInstances = [];
    }

    // Merge both sources
    const agencyOwnedIds = (clientInstanceRecords || []).map(ci => ci.instance_id);
    const clientOwnedIds = (clientOwnedInstances || []).map(i => i.id);
    const allInstanceIds = [...new Set([...clientOwnedIds, ...agencyOwnedIds])];

    if (allInstanceIds.length === 0) {
      return NextResponse.json({ executions: [] });
    }

    // Use first instance
    instanceId = allInstanceIds[0];

    // Get instance details (must not be deleted)
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('instance_url, n8n_api_key')
      .eq('id', instanceId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!instance?.instance_url || !instance?.n8n_api_key) {
      return NextResponse.json({ executions: [] });
    }

    // Fetch recent executions from n8n using helper (handles SSL bypass)
    const result = await fetchN8nExecutions(instance.instance_url, instance.n8n_api_key, 20);

    if (result.error) {
      console.error('n8n fetch error:', result.error);
      return NextResponse.json({ executions: [], error: result.error });
    }

    return NextResponse.json({ executions: result.executions });
  } catch (error) {
    console.error('Client executions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
