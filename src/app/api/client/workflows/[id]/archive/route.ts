import { NextRequest, NextResponse } from 'next/server';
import { archiveN8nWorkflow, unarchiveN8nWorkflow } from '@/lib/n8nInstanceApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Archive or unarchive a workflow
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: workflowId } = await params;

    // Validate workflow ID format (n8n workflow IDs are alphanumeric)
    if (!workflowId || !/^[a-zA-Z0-9]+$/.test(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID format' }, { status: 400 });
    }

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

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { archive, instanceId } = body;

    // Validate archive parameter
    if (typeof archive !== 'boolean') {
      return NextResponse.json({ error: 'Invalid archive parameter: must be a boolean' }, { status: 400 });
    }

    // Validate instanceId if provided
    if (instanceId && typeof instanceId !== 'string') {
      return NextResponse.json({ error: 'Invalid instanceId format' }, { status: 400 });
    }

    let instance;

    if (instanceId) {
      // Use the specific instance ID provided
      // Check BOTH client-owned and agency-owned access
      const [{ data: clientOwnedInstance }, { data: agencyAccess }] = await Promise.all([
        // Check if user directly owns this instance (client-owned)
        supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('id, instance_url, n8n_api_key, deleted_at, subscription_status')
          .eq('id', instanceId)
          .eq('user_id', effectiveUserId)
          .is('deleted_at', null)
          .maybeSingle(),
        // Check if user has agency access (invited_by)
        supabaseAdmin
          .from('client_instances')
          .select('instance_id')
          .eq('instance_id', instanceId)
          .eq('user_id', user.id)
          .maybeSingle()
      ]);

      if (clientOwnedInstance) {
        instance = clientOwnedInstance;
      } else if (agencyAccess) {
        // User has agency access - fetch the instance
        const { data: agencyOwnedInstance } = await supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('instance_url, n8n_api_key, deleted_at, subscription_status')
          .eq('id', instanceId)
          .is('deleted_at', null)
          .maybeSingle();
        instance = agencyOwnedInstance;
      }

      if (!instance) {
        return NextResponse.json({ error: 'Instance not found or access denied' }, { status: 404 });
      }
    } else {
      // Fallback: Get client instance from BOTH sources (old behavior for backward compatibility)
      const [{ data: clientInstanceRecord }, { data: clientOwnedInstance }] = await Promise.all([
        supabaseAdmin
          .from('client_instances')
          .select('instance_id')
          .eq('user_id', user.id)
          .maybeSingle(),
        supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('id, instance_url, n8n_api_key, deleted_at, subscription_status')
          .eq('user_id', effectiveUserId)
          .not('invited_by_user_id', 'is', null)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle()
      ]);

      // Prefer client-owned, then agency-owned
      if (clientOwnedInstance) {
        instance = clientOwnedInstance;
      } else if (clientInstanceRecord) {
        const { data: agencyOwnedInstance } = await supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('instance_url, n8n_api_key, deleted_at, subscription_status')
          .eq('id', clientInstanceRecord.instance_id)
          .maybeSingle();
        instance = agencyOwnedInstance;
      }

      if (!instance) {
        return NextResponse.json({ error: 'Client instance not found' }, { status: 404 });
      }
    }

    if (!instance?.instance_url || !instance?.n8n_api_key) {
      return NextResponse.json({ error: 'Instance not configured' }, { status: 400 });
    }

    if (instance.deleted_at) {
      return NextResponse.json({ error: 'Instance is no longer available' }, { status: 404 });
    }

    if (instance.subscription_status !== 'active' && instance.subscription_status !== 'trialing') {
      return NextResponse.json({ error: 'Instance subscription is not active' }, { status: 403 });
    }

    // Archive or unarchive the workflow
    const result = archive
      ? await archiveN8nWorkflow(instance.instance_url, instance.n8n_api_key, workflowId)
      : await unarchiveN8nWorkflow(instance.instance_url, instance.n8n_api_key, workflowId);

    if (!result.success) {
      console.error('[archive] Failed to archive workflow:', {
        workflowId,
        instanceUrl: instance.instance_url,
        error: result.error,
        userId: user.id
      });
      return NextResponse.json({ error: result.error || 'Failed to archive workflow' }, { status: 400 });
    }

    return NextResponse.json({ success: true, archived: archive });
  } catch (error) {
    console.error('Archive workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
