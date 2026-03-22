/**
 * All Executions API - Aggregates data from all user's n8n instances
 *
 * This endpoint powers the "All" view in the portal page, fetching:
 * - Workflow executions with status and timing
 * - Workflows with credential connection status
 * - UI widgets (components) for each instance
 * - Aggregated metrics (total, success, failed, running)
 *
 * Data sources:
 * - n8n instance APIs (executions, workflows, credentials)
 * - client_widgets table (UI components)
 * - client_instances table (client email mapping)
 *
 * @returns {Object} { executions, workflows, instances, metrics, widgets, failedInstances? }
 */
import { NextRequest, NextResponse } from 'next/server';
import { fetchN8nExecutions, fetchN8nWorkflows, extractCredentialsFromWorkflows } from '@/lib/n8nInstanceApi';
import { checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


/** Fetches aggregated execution data, workflows, and widgets from all user's instances */
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

    // Rate limit: max 30 requests per minute per user (this endpoint is expensive)
    const rateLimitResult = checkRateLimit(`all-executions:${user.id}`, 30, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    // Resolve team access
    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get all instances user has access to (owned or managed)
    const { data: instances, error: instancesError } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, instance_name, instance_url, n8n_api_key, user_id')
      .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
      .neq('subscription_status', 'canceled')
      .is('deleted_at', null)
      .not('n8n_api_key', 'is', null);

    if (instancesError) {
      console.error('Failed to fetch instances:', instancesError);
      return NextResponse.json({ error: 'Failed to fetch instances' }, { status: 500 });
    }

    if (!instances || instances.length === 0) {
      return NextResponse.json({
        executions: [],
        workflows: [],
        instances: [],
        metrics: { total: 0, success: 0, failed: 0, running: 0 },
        widgets: [],
        failedInstances: undefined,
      });
    }

    // Get client emails for instances
    const instanceIds = instances.map(i => i.id);
    let clientEmailMap: Record<string, string> = {};

    const { data: clientInstances } = await supabaseAdmin
      .from('client_instances')
      .select('instance_id, user_id')
      .in('instance_id', instanceIds);

    if (clientInstances && clientInstances.length > 0) {
      const clientUserIds = clientInstances.map(ci => ci.user_id);
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .in('id', clientUserIds);

      const userEmailMap: Record<string, string> = {};
      profiles?.forEach(p => {
        userEmailMap[p.id] = p.email;
      });

      clientInstances.forEach(ci => {
        if (userEmailMap[ci.user_id]) {
          clientEmailMap[ci.instance_id] = userEmailMap[ci.user_id];
        }
      });
    }

    // Fetch widgets for all instances (exclude drafts)
    const widgetsResult = await supabaseAdmin
      .from('client_widgets')
      .select('id, name, widget_type, workflow_id, instance_id, form_fields')
      .in('instance_id', instanceIds)
      .not('name', 'like', '__DRAFT__%');

    if (widgetsResult.error) {
      console.error('Failed to fetch widgets:', widgetsResult.error);
    }

    // Create maps for quick lookup
    const widgetsByInstance: Record<string, any[]> = {};
    const widgetsByWorkflow: Record<string, any[]> = {};
    (widgetsResult.data || []).forEach(w => {
      if (!widgetsByInstance[w.instance_id]) widgetsByInstance[w.instance_id] = [];
      widgetsByInstance[w.instance_id].push(w);
      if (w.workflow_id) {
        const key = `${w.instance_id}:${w.workflow_id}`;
        if (!widgetsByWorkflow[key]) widgetsByWorkflow[key] = [];
        widgetsByWorkflow[key].push(w);
      }
    });

    // Fetch executions, workflows, and credentials from all instances in parallel
    const results = await Promise.allSettled(
      instances.map(async (inst) => {
        const [execResult, workflowsResult, credentialsResult] = await Promise.all([
          fetchN8nExecutions(inst.instance_url, inst.n8n_api_key!, 20),
          fetchN8nWorkflows(inst.instance_url, inst.n8n_api_key!),
          extractCredentialsFromWorkflows(inst.instance_url, inst.n8n_api_key!),
        ]);

        // Get connected credential types from n8n (actual data, not local records)
        const connectedCredTypes = new Set(credentialsResult.credentials?.map(c => c.type) || []);

        return {
          instanceId: inst.id,
          instanceName: inst.instance_name,
          instanceUrl: inst.instance_url,
          clientEmail: clientEmailMap[inst.id],
          executions: execResult.executions?.map(exec => ({
            ...exec,
            instanceId: inst.id,
            instanceName: inst.instance_name,
            clientEmail: clientEmailMap[inst.id],
          })) || [],
          workflows: workflowsResult.workflows?.map(wf => {
            const workflowKey = `${inst.id}:${wf.id}`;
            const linkedWidgets = widgetsByWorkflow[workflowKey] || [];
            // Check which required credentials are connected (using actual n8n data)
            const credentialsWithStatus = (wf.requiredCredentials || []).map((cred: any) => ({
              ...cred,
              connected: connectedCredTypes.has(cred.type),
            }));
            return {
              ...wf,
              instanceId: inst.id,
              instanceName: inst.instance_name,
              clientEmail: clientEmailMap[inst.id],
              credentials: credentialsWithStatus,
              widgets: linkedWidgets.map(w => ({ id: w.id, name: w.name, type: w.widget_type, form_fields: w.form_fields })),
            };
          }) || [],
          metrics: execResult.metrics,
        };
      })
    );

    // Aggregate results and track failed instances
    const allExecutions: any[] = [];
    const allWorkflows: any[] = [];
    const instancesList: any[] = [];
    const failedInstances: { instanceId: string; instanceName: string; error: string }[] = [];
    let totalMetrics = { total: 0, success: 0, failed: 0, running: 0 };

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        const data = result.value;
        allExecutions.push(...data.executions);
        allWorkflows.push(...data.workflows);
        instancesList.push({
          instanceId: data.instanceId,
          instanceName: data.instanceName,
          instanceUrl: data.instanceUrl,
          clientEmail: data.clientEmail,
        });
        if (data.metrics) {
          totalMetrics.total += data.metrics.total || 0;
          totalMetrics.success += data.metrics.success || 0;
          totalMetrics.failed += data.metrics.failed || 0;
          totalMetrics.running += data.metrics.running || 0;
        }
      } else {
        // Track failed instance for UI feedback
        const inst = instances[index];
        failedInstances.push({
          instanceId: inst.id,
          instanceName: inst.instance_name,
          error: result.reason?.message || 'Failed to connect',
        });
      }
    });

    // Sort executions by date (newest first)
    allExecutions.sort((a, b) =>
      new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    // Flatten all widgets with instance info for the Assign Component modal
    const allWidgets = (widgetsResult.data || []).map(w => ({
      id: w.id,
      name: w.name,
      widget_type: w.widget_type,
      workflow_id: w.workflow_id,
      instance_id: w.instance_id,
      form_fields: w.form_fields,
    }));

    return NextResponse.json({
      executions: allExecutions,
      workflows: allWorkflows,
      instances: instancesList,
      metrics: totalMetrics,
      widgets: allWidgets,
      // Include failed instances so UI can show warnings
      failedInstances: failedInstances.length > 0 ? failedInstances : undefined,
    });
  } catch (error) {
    console.error('All executions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
