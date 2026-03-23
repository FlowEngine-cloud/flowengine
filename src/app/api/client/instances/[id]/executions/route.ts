import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { fetchN8nExecutions } from '@/lib/n8nInstanceApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET: Get recent executions for a client's instance (agency view)
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await params;

    // Validate UUID format
    if (!isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Invalid instance ID format' }, { status: 400 });
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

    // Verify this is an instance the user has access to:
    // 1. They own it directly (user_id) in pay_per_instance_deployments
    // 2. They're the agency manager for a client-paid instance (invited_by_user_id)
    // 3. They're the agency/client for a legacy client_instances entry
    // 4. They own a dedicated instance in n8n_instances
    const { data: accessibleInstance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id')
      .eq('id', instanceId)
      .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
      .is('deleted_at', null)
      .maybeSingle();

    if (!accessibleInstance) {
      // Fallback: Check legacy client_instances table
      const { data: clientInstance } = await supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('instance_id', instanceId)
        .or(`invited_by.eq.${effectiveUserId},user_id.eq.${effectiveUserId}`)
        .maybeSingle();

      if (!clientInstance) {
        // Fallback: Check dedicated instances (n8n_instances table)
        const { data: dedicatedInstance } = await supabaseAdmin
          .from('n8n_instances')
          .select('id')
          .eq('id', instanceId)
          .eq('user_id', effectiveUserId)
          .neq('status', 'deleted')
          .maybeSingle();

        if (!dedicatedInstance) {
          return NextResponse.json({ error: 'Access denied' }, { status: 403 });
        }
      }
    }

    // Get instance details — check pay_per_instance_deployments first, fall back to n8n_instances
    let instanceUrl: string | null = null;
    let instanceApiKey: string | null = null;

    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('instance_url, n8n_api_key, is_external')
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
      return NextResponse.json({ executions: [], warning: 'Instance URL or API key not configured' });
    }

    // External/demo instance — return mock executions without hitting real n8n
    if (instance?.is_external) {
      const now = Date.now();
      return NextResponse.json({
        executions: [
          { id: 'exec-1', workflowId: 'demo-wf-1', workflowName: 'Lead Qualification Agent', status: 'success', startedAt: new Date(now - 5   * 60 * 1000).toISOString() },
          { id: 'exec-2', workflowId: 'demo-wf-2', workflowName: 'Customer Support Bot',      status: 'success', startedAt: new Date(now - 12  * 60 * 1000).toISOString() },
          { id: 'exec-3', workflowId: 'demo-wf-1', workflowName: 'Lead Qualification Agent', status: 'running', startedAt: new Date(now - 2   * 60 * 1000).toISOString() },
          { id: 'exec-4', workflowId: 'demo-wf-2', workflowName: 'Customer Support Bot',      status: 'error',   startedAt: new Date(now - 35  * 60 * 1000).toISOString() },
          { id: 'exec-5', workflowId: 'demo-wf-3', workflowName: 'Data Sync to Sheets',       status: 'success', startedAt: new Date(now - 60  * 60 * 1000).toISOString() },
          { id: 'exec-6', workflowId: 'demo-wf-1', workflowName: 'Lead Qualification Agent', status: 'success', startedAt: new Date(now - 90  * 60 * 1000).toISOString() },
          { id: 'exec-7', workflowId: 'demo-wf-3', workflowName: 'Data Sync to Sheets',       status: 'success', startedAt: new Date(now - 120 * 60 * 1000).toISOString() },
        ],
        metrics: { total: 312, success: 298, failed: 12, running: 2 },
      });
    }

    // Fetch recent executions from n8n using helper (handles SSL bypass)
    const result = await fetchN8nExecutions(instanceUrl, instanceApiKey, 20);

    if (result.error) {
      return NextResponse.json({
        executions: [],
        metrics: null,
        warning: result.error
      });
    }

    return NextResponse.json({
      executions: result.executions,
      metrics: result.metrics
    });
  } catch (error) {
    console.error('Client executions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
