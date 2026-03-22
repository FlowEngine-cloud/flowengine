import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { fetchN8nWorkflows, fetchN8nArchivedWorkflows } from '@/lib/n8nInstanceApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET: List workflows for client's instance
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

    // Resolve effective user ID (team members act as team owner)
    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Check for preview mode or specific instance selection
    const { searchParams } = new URL(req.url);
    const previewInstanceId = searchParams.get('preview');
    const selectedInstanceId = searchParams.get('instanceId');
    const fetchArchived = searchParams.get('archived') === 'true';

    let instanceId: string;

    // Preview mode: Instance owner or agency manager previewing
    if (previewInstanceId && isValidUUID(previewInstanceId)) {
      // SECURITY: Fetch instance first, then verify access explicitly
      const { data: instance } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, user_id, invited_by_user_id')
        .eq('id', previewInstanceId)
        .maybeSingle();

      if (!instance) {
        // Fallback: check dedicated instances (n8n_instances table)
        const { data: dedicatedInstance } = await supabaseAdmin
          .from('n8n_instances')
          .select('id, user_id')
          .eq('id', previewInstanceId)
          .eq('user_id', effectiveUserId)
          .neq('status', 'deleted')
          .maybeSingle();

        if (!dedicatedInstance) {
          return NextResponse.json({ error: 'Instance not found' }, { status: 403 });
        }
      } else {
        // SECURITY: Explicit authorization check for pay-per-instance
        const isOwner = instance.user_id === effectiveUserId;
        const isInviter = instance.invited_by_user_id === effectiveUserId;
        if (!isOwner && !isInviter) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
      instanceId = previewInstanceId;
    } else {
      // Normal client mode - check ALL sources:
      // 1. client_instances (agency-owned instances)
      // 2. pay_per_instance_deployments with invited_by_user_id (client-owned instances)
      // 3. n8n_instances (dedicated/Pro instances owned by user)
      const [{ data: clientInstanceRecords }, { data: clientOwnedInstances }, { data: dedicatedInstances }] = await Promise.all([
        supabaseAdmin
          .from('client_instances')
          .select('instance_id')
          .eq('user_id', effectiveUserId),
        supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('id')
          .eq('user_id', effectiveUserId)
          .not('invited_by_user_id', 'is', null)
          .is('deleted_at', null),
        supabaseAdmin
          .from('n8n_instances')
          .select('id')
          .eq('user_id', effectiveUserId)
          .neq('status', 'deleted')
      ]);

      // Merge all sources
      const agencyOwnedIds = (clientInstanceRecords || []).map(ci => ci.instance_id);
      const clientOwnedIds = (clientOwnedInstances || []).map(i => i.id);
      const dedicatedIds = (dedicatedInstances || []).map(i => i.id);
      const allInstanceIds = [...new Set([...clientOwnedIds, ...agencyOwnedIds, ...dedicatedIds])];

      if (allInstanceIds.length === 0) {
        return NextResponse.json({ workflows: [] });
      }

      // If specific instance requested, verify access
      if (selectedInstanceId && isValidUUID(selectedInstanceId)) {
        if (!allInstanceIds.includes(selectedInstanceId)) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
        instanceId = selectedInstanceId;
      } else {
        // Use first instance
        instanceId = allInstanceIds[0];
      }
    }

    // Get instance details — check pay_per_instance_deployments first, fall back to n8n_instances
    let instanceUrl: string | null = null;
    let instanceApiKey: string | null = null;

    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('instance_url, n8n_api_key')
      .eq('id', instanceId)
      .is('deleted_at', null)
      .maybeSingle();

    if (instance) {
      instanceUrl = instance.instance_url;
      instanceApiKey = instance.n8n_api_key;
    } else {
      // Fallback: dedicated instance
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('instance_url, n8n_api_key')
        .eq('id', instanceId)
        .neq('status', 'deleted')
        .maybeSingle();

      if (dedicatedInstance) {
        instanceUrl = dedicatedInstance.instance_url;
        instanceApiKey = dedicatedInstance.n8n_api_key;
      }
    }

    if (!instanceUrl || !instanceApiKey) {
      return NextResponse.json({ workflows: [] });
    }

    // Fetch workflows from n8n using helper (handles SSL bypass)
    const result = fetchArchived
      ? await fetchN8nArchivedWorkflows(instanceUrl, instanceApiKey)
      : await fetchN8nWorkflows(instanceUrl, instanceApiKey);

    if (result.error) {
      console.error('n8n fetch error:', result.error);
      return NextResponse.json({ workflows: [], error: result.error });
    }

    // Include warning if credential detection failed for some workflows
    const warning = !fetchArchived && 'warning' in result ? (result as { warning?: string }).warning : undefined;
    return NextResponse.json({
      workflows: result.workflows,
      archived: fetchArchived,
      ...(warning && { warning }),
    });
  } catch (error) {
    console.error('Client workflows error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
