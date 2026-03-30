/**
 * Template Update API - Single Import
 * GET - Get update details and preview
 * POST - Perform the update
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  extractNodeConfigs,
  applyNodeConfigs,
  saveNodeConfigs,
} from '@/lib/templateUpdates';
import { fixNodeTypeVersions } from '@/lib/n8n/aiAgentValidator';
import { checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


interface RouteParams {
  params: Promise<{ importId: string }>;
}

/**
 * GET /api/client/template-updates/[importId]
 * Get update details including preview of what will change
 */
// UUID validation regex
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { importId } = await params;

    // Validate importId is a valid UUID
    if (!importId || !UUID_REGEX.test(importId)) {
      return NextResponse.json({ error: 'Invalid import ID format' }, { status: 400 });
    }

    // Get auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Rate limit: max 60 preview requests per minute per user
    const rateLimitResult = checkRateLimit(`template-update-preview:${user.id}`, 60, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    // Get import record with template and instance info
    const { data: importRecord, error: importError } = await supabaseAdmin
      .from('workflow_template_imports')
      .select(`
        id,
        instance_id,
        n8n_workflow_id,
        installed_version,
        imported_by,
        workflow_templates (
          id,
          name,
          version,
          changelog,
          workflow_json,
          is_active
        )
      `)
      .eq('id', importId)
      .single();

    if (importError || !importRecord) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    // Verify user has access to this instance — check pay_per_instance first, fall back to n8n_instances
    let instance: { id: string; user_id: string; instance_url: string; n8n_api_key: string } | null = null;

    const { data: payPerInstance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, instance_url, n8n_api_key')
      .eq('id', importRecord.instance_id)
      .maybeSingle();

    if (payPerInstance) {
      instance = payPerInstance;
    } else {
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('id, user_id, instance_url, n8n_api_key')
        .eq('id', importRecord.instance_id)
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

    if (payPerInstance) {
      const isOwner = instance.user_id === effectiveUserId;
      const { data: clientAccess } = await supabaseAdmin
        .from('client_instances')
        .select('id')
        .eq('instance_id', instance.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isOwner && !clientAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    const template = importRecord.workflow_templates as any;
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if template is still active
    if (template.is_active === false) {
      return NextResponse.json({
        hasUpdate: false,
        message: 'This template has been deactivated by the agency',
      });
    }

    const installedVersion = importRecord.installed_version || 1;
    const latestVersion = template.version || 1;

    // Check if update is available
    if (latestVersion <= installedVersion) {
      return NextResponse.json({
        hasUpdate: false,
        message: 'Already up to date',
      });
    }

    // Fetch current workflow from n8n to preview changes and get workflow name
    let preview = null;
    let workflowName = null;
    if (instance.n8n_api_key && importRecord.n8n_workflow_id) {
      try {
        const currentRes = await fetch(
          `${instance.instance_url}/api/v1/workflows/${importRecord.n8n_workflow_id}`,
          { headers: { 'X-N8N-API-KEY': instance.n8n_api_key } }
        );

        if (currentRes.ok) {
          const currentWorkflow = await currentRes.json();
          workflowName = currentWorkflow.name; // Get the actual workflow name from n8n
          const currentConfigs = extractNodeConfigs(currentWorkflow);
          const { matched, unmatched, newNodes, preservedNodes, addedNodes, changedNodes } = applyNodeConfigs(
            template.workflow_json,
            currentConfigs
          );

          preview = {
            preserved: matched,
            needsConfig: newNodes,
            warnings: unmatched,
            currentNodeCount: currentWorkflow.nodes?.length || 0,
            newNodeCount: template.workflow_json?.nodes?.length || 0,
            // New detailed info
            preservedNodes,
            addedNodes,
            changedNodes,
          };
        }
      } catch (e) {
        console.error('[template-updates] Error fetching workflow for preview:', e);
      }
    }

    return NextResponse.json({
      hasUpdate: true,
      importId: importRecord.id,
      workflowId: importRecord.n8n_workflow_id,
      workflowName, // The actual workflow name from n8n
      templateId: template.id,
      templateName: template.name,
      installedVersion,
      latestVersion,
      changelog: template.changelog,
      preview,
    });
  } catch (error) {
    console.error('Error in GET /api/client/template-updates/[importId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/client/template-updates/[importId]
 * Perform the template update
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { importId } = await params;

    // Validate importId is a valid UUID
    if (!importId || !UUID_REGEX.test(importId)) {
      return NextResponse.json({ error: 'Invalid import ID format' }, { status: 400 });
    }

    // Get auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Rate limit: max 10 update operations per minute per user (expensive operation)
    const rateLimitResult = checkRateLimit(`template-update-perform:${user.id}`, 10, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many update requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    // Get import record
    const { data: importRecord, error: importError } = await supabaseAdmin
      .from('workflow_template_imports')
      .select(`
        id,
        instance_id,
        n8n_workflow_id,
        installed_version,
        workflow_templates (
          id,
          name,
          version,
          changelog,
          workflow_json,
          is_active
        )
      `)
      .eq('id', importId)
      .single();

    if (importError || !importRecord) {
      return NextResponse.json({ error: 'Import not found' }, { status: 404 });
    }

    // Verify access and get instance details — check pay_per_instance first, fall back to n8n_instances
    let instance: { id: string; user_id: string; instance_url: string; n8n_api_key: string; subscription_status?: string } | null = null;

    const { data: payPerInstance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, instance_url, n8n_api_key, subscription_status')
      .eq('id', importRecord.instance_id)
      .maybeSingle();

    if (payPerInstance) {
      instance = payPerInstance;
    } else {
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('id, user_id, instance_url, n8n_api_key')
        .eq('id', importRecord.instance_id)
        .eq('user_id', effectiveUserId)
        .neq('status', 'deleted')
        .maybeSingle();

      if (dedicatedInstance) {
        instance = { ...dedicatedInstance, subscription_status: 'active' };
      }
    }

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    if (payPerInstance) {
      const isOwner = instance.user_id === effectiveUserId;
      const { data: clientAccess } = await supabaseAdmin
        .from('client_instances')
        .select('id')
        .eq('instance_id', instance.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (!isOwner && !clientAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Verify subscription is active
    if (!['active', 'trialing'].includes(instance.subscription_status || 'active')) {
      return NextResponse.json({
        error: 'Subscription not active',
        message: 'Your subscription is not active. Please contact support to continue using this feature.',
      }, { status: 400 });
    }

    if (!instance.n8n_api_key) {
      return NextResponse.json({ error: 'Instance API key not configured' }, { status: 400 });
    }

    const template = importRecord.workflow_templates as any;
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Check if template is still active
    if (template.is_active === false) {
      return NextResponse.json({
        error: 'Template deactivated',
        message: 'This template has been deactivated by the agency and can no longer be updated.',
      }, { status: 400 });
    }

    const installedVersion = importRecord.installed_version || 1;
    const latestVersion = template.version || 1;

    if (latestVersion <= installedVersion) {
      return NextResponse.json({
        success: true,
        message: 'Already up to date',
      });
    }

    // 1. Fetch current workflow from n8n
    const currentRes = await fetch(
      `${instance.instance_url}/api/v1/workflows/${importRecord.n8n_workflow_id}`,
      { headers: { 'X-N8N-API-KEY': instance.n8n_api_key } }
    );

    if (!currentRes.ok) {
      // Check if workflow was deleted from n8n
      if (currentRes.status === 404) {
        return NextResponse.json({
          error: 'Workflow not found in n8n',
          message: 'This workflow may have been deleted from n8n. You can re-import the template to get the latest version.',
          code: 'WORKFLOW_NOT_FOUND',
        }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch current workflow from n8n' }, { status: 502 });
    }

    const currentWorkflow = await currentRes.json();

    // 2. Extract current configuration
    const configs = extractNodeConfigs(currentWorkflow);

    // 3. Save configs to database (backup before update)
    const saveResult = await saveNodeConfigs(importId, configs);
    if (!saveResult.success) {
      console.error('[template-updates] Failed to backup configs:', saveResult.error);
      return NextResponse.json({
        error: 'Failed to backup current configuration. Update aborted.',
        details: saveResult.error,
      }, { status: 500 });
    }

    // 4. Apply saved configs to new template
    const { workflow: updatedWorkflow, matched, unmatched, newNodes, preservedNodes, addedNodes, changedNodes } =
      applyNodeConfigs(template.workflow_json, configs);

    // 5. Fix any missing typeVersions
    fixNodeTypeVersions(updatedWorkflow);

    // 6. Generate fresh webhookIds for trigger nodes
    if (updatedWorkflow.nodes && Array.isArray(updatedWorkflow.nodes)) {
      for (const node of updatedWorkflow.nodes) {
        const isTrigger = node.type?.includes('Trigger') ||
                          node.type?.includes('trigger') ||
                          node.type?.includes('webhook') ||
                          node.type?.includes('Webhook');
        if (isTrigger && !node.webhookId) {
          node.webhookId = crypto.randomUUID();
        }
      }
    }

    // 7. Update workflow in n8n (preserve user's workflow name)
    const updateRes = await fetch(
      `${instance.instance_url}/api/v1/workflows/${importRecord.n8n_workflow_id}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-N8N-API-KEY': instance.n8n_api_key,
        },
        body: JSON.stringify({
          name: currentWorkflow.name, // Keep user's name
          nodes: updatedWorkflow.nodes,
          connections: updatedWorkflow.connections,
          settings: { ...currentWorkflow.settings, ...updatedWorkflow.settings },
        }),
      }
    );

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('[template-updates] n8n update failed:', errText);
      return NextResponse.json({
        error: 'Failed to update workflow in n8n',
        details: errText,
      }, { status: 502 });
    }

    // 8. Update import record
    const { error: updateRecordError } = await supabaseAdmin
      .from('workflow_template_imports')
      .update({
        installed_version: latestVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId);

    if (updateRecordError) {
      // n8n was updated but DB record failed - log for manual reconciliation
      console.error('[template-updates] Failed to update import record:', updateRecordError);
      // Still return success since n8n was updated, but warn the user
      return NextResponse.json({
        success: true,
        message: 'Workflow updated, but version tracking may be out of sync',
        warning: 'Database record update failed - please refresh to verify',
        result: {
          preserved: matched,
          needsConfig: newNodes,
          warnings: unmatched,
          newVersion: latestVersion,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Workflow updated successfully',
      result: {
        preserved: matched,
        needsConfig: newNodes,
        warnings: unmatched,
        newVersion: latestVersion,
      },
    });
  } catch (error) {
    console.error('Error in POST /api/client/template-updates/[importId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
