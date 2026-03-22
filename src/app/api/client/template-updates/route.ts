/**
 * Template Updates API
 * GET - Check for available updates for an instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


/**
 * GET /api/client/template-updates?instanceId=xxx
 * Get all available template updates for an instance
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    // Validate UUID format
    if (!isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Invalid instanceId format' }, { status: 400 });
    }

    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify user session
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Rate limit: max 60 requests per minute per user
    const rateLimitResult = checkRateLimit(`template-updates:${user.id}`, 60, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Verify user has access to this instance — check pay_per_instance first, fall back to n8n_instances
    let instance: { id: string; user_id: string; instance_url: string; n8n_api_key: string } | null = null;

    const { data: payPerInstance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, instance_url, n8n_api_key')
      .eq('id', instanceId)
      .maybeSingle();

    if (payPerInstance) {
      instance = payPerInstance;
    } else {
      // Fallback: dedicated instance (n8n_instances table)
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('id, user_id, instance_url, n8n_api_key')
        .eq('id', instanceId)
        .eq('user_id', effectiveUserId)
        .neq('status', 'deleted')
        .maybeSingle();

      if (dedicatedInstance) {
        instance = dedicatedInstance;
      }
    }

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // For pay-per-instance: verify owner or client access
    if (payPerInstance) {
      const isOwner = instance.user_id === effectiveUserId;
      const { data: clientAccess } = await supabaseAdmin
        .from('client_instances')
        .select('id')
        .eq('instance_id', instanceId)
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (!isOwner && !clientAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }
    // For dedicated instances: eq('user_id', user.id) in the query already ensures ownership

    // Get all imports for this instance with their template versions
    // Only include active templates (deactivated templates shouldn't show updates)
    const { data: imports, error: importsError } = await supabaseAdmin
      .from('workflow_template_imports')
      .select(`
        id,
        n8n_workflow_id,
        installed_version,
        status,
        workflow_templates!inner (
          id,
          name,
          version,
          changelog,
          updated_at,
          workflow_json,
          is_active
        )
      `)
      .eq('instance_id', instanceId)
      .eq('status', 'imported');

    if (importsError) {
      console.error('Error fetching imports:', importsError);
      return NextResponse.json({ error: 'Failed to fetch imports' }, { status: 500 });
    }

    // Filter to only those with updates available and active templates
    const importsWithUpdates = (imports || []).filter(imp => {
      const template = imp.workflow_templates as any;
      if (!template) return false;
      // Skip deactivated templates
      if (template.is_active === false) return false;
      const installed = imp.installed_version || 1;
      const latest = template.version || 1;
      return latest > installed;
    });

    // Fetch workflow names from n8n for each import
    // Use Promise.allSettled() to handle individual n8n API failures gracefully
    const updatesPromises = importsWithUpdates.map(async (imp) => {
      const template = imp.workflow_templates as any;
      let workflowName: string | null = null;
      let workflowExists = false;

      // Try to fetch workflow from n8n to verify it still exists
      // Only show updates for workflows we can CONFIRM exist in n8n
      if (instance.n8n_api_key && imp.n8n_workflow_id) {
        try {
          const url = `${instance.instance_url}/api/v1/workflows/${imp.n8n_workflow_id}`;
          const res = await fetch(url, {
            headers: { 'X-N8N-API-KEY': instance.n8n_api_key },
          });
          if (res.ok) {
            const workflow = await res.json();
            workflowName = workflow.name;
            workflowExists = true;
            console.log(`[template-updates] Workflow ${imp.n8n_workflow_id} confirmed: "${workflowName}"`);
          } else if (res.status === 404) {
            // Workflow was deleted from n8n - don't show update
            console.log(`[template-updates] Workflow ${imp.n8n_workflow_id} not found in n8n (deleted)`);
            workflowExists = false;
          } else {
            // Other error - can't confirm workflow exists, skip it
            console.log(`[template-updates] Cannot verify workflow ${imp.n8n_workflow_id}: ${res.status} ${res.statusText}`);
            workflowExists = false;
          }
        } catch (e) {
          // Network error - can't confirm workflow exists, skip it
          console.error(`[template-updates] Network error checking workflow ${imp.n8n_workflow_id}:`, e);
          workflowExists = false;
        }
      } else {
        // No API key or workflow ID - can't verify, skip it
        console.log(`[template-updates] Cannot verify workflow (missing apiKey or workflowId): apiKey=${!!instance.n8n_api_key}, workflowId=${imp.n8n_workflow_id}`);
        workflowExists = false;
      }

      // Skip workflows that don't exist in n8n
      if (!workflowExists) {
        return null;
      }

      return {
        importId: imp.id,
        workflowId: imp.n8n_workflow_id,
        workflowName: workflowName || template.name, // Fallback to template name
        templateId: template.id,
        templateName: template.name,
        installedVersion: imp.installed_version || 1,
        latestVersion: template.version || 1,
        changelog: template.changelog,
        updatedAt: template.updated_at,
      };
    });

    // Use allSettled to handle individual failures without failing entire request
    const settledResults = await Promise.allSettled(updatesPromises);

    // Extract successful results and filter out null entries (deleted workflows)
    const updates = settledResults
      .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
      .map(result => result.value)
      .filter((u): u is NonNullable<typeof u> => u !== null);

    return NextResponse.json({
      updates,
      count: updates.length,
    });
  } catch (error) {
    console.error('Error in GET /api/client/template-updates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
