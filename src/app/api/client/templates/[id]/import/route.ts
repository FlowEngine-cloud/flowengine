/**
 * Template Import API
 * POST - Import a workflow template to the client's n8n instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchN8nCredentials, extractCredentialsFromWorkflows, n8nFetch } from '@/lib/n8nInstanceApi';
import { checkCredentialStatus, prepareWorkflowForImport, getMissingCredentials } from '@/lib/n8n/credentialExtractor';
import { fixNodeTypeVersions } from '@/lib/n8n/aiAgentValidator';
import { checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Initialize Supabase client with service role

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/client/templates/[id]/import
 * Import a workflow template to the client's n8n instance
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: templateId } = await params;

    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify user session first for rate limit key
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Rate limit: 10 imports per minute per user
    const rateLimit = checkRateLimit(`template-import:${user.id}`, 10, 60000);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many import requests. Please wait before trying again.', resetIn: Math.ceil(rateLimit.resetIn / 1000) },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { instanceId, credentialSelections } = body;

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    // Get instance and verify access — check pay_per_instance first, fall back to n8n_instances
    let instance: any = null;

    const { data: payPerInstance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, instance_url, n8n_api_key, user_id, subscription_status')
      .eq('id', instanceId)
      .maybeSingle();

    if (payPerInstance) {
      instance = payPerInstance;
    } else {
      // Fallback: dedicated instance (n8n_instances table)
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('id, instance_url, n8n_api_key, user_id')
        .eq('id', instanceId)
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

    // Check if user is a client or owner
    const isOwner = instance.user_id === effectiveUserId;
    const { data: clientAccess } = await supabaseAdmin
      .from('client_instances')
      .select('invited_by')
      .eq('instance_id', instanceId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!isOwner && !clientAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify instance has API key
    if (!instance.n8n_api_key) {
      return NextResponse.json({ error: 'Instance API key not configured' }, { status: 400 });
    }

    // Verify subscription is active
    if (!['active', 'trialing'].includes(instance.subscription_status)) {
      return NextResponse.json({ error: 'Instance subscription is not active' }, { status: 400 });
    }

    // Get the template
    const agencyId = clientAccess?.invited_by || (isOwner ? effectiveUserId : null);

    const { data: template, error: templateError } = await supabaseAdmin
      .from('workflow_templates')
      .select('*')
      .eq('id', templateId)
      .eq('user_id', agencyId)
      .eq('is_active', true)
      .single();

    if (templateError || !template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Fetch user's credentials from n8n
    // Fallback to extracting from workflows if direct API fails
    let userCredentials: Array<{ id: string; name: string; type: string }> = [];
    const { credentials: directCredentials, error: credError } = await fetchN8nCredentials(
      instance.instance_url,
      instance.n8n_api_key
    );

    if (!credError && directCredentials.length > 0) {
      userCredentials = directCredentials;
    } else {
      // Fallback: extract from workflow nodes
      console.log('[template-import] Credentials API failed, extracting from workflows...');
      const { credentials: extractedCreds } = await extractCredentialsFromWorkflows(
        instance.instance_url,
        instance.n8n_api_key
      );
      userCredentials = extractedCreds;

      // Also check local records
      const { data: localRecords } = await supabaseAdmin
        .from('credential_records')
        .select('id, n8n_credential_id, type, name')
        .eq('instance_id', instanceId);

      if (localRecords && localRecords.length > 0) {
        const existingIds = new Set(userCredentials.map(c => c.id));
        for (const record of localRecords) {
          const id = record.n8n_credential_id || record.id;
          if (!existingIds.has(id)) {
            userCredentials.push({ id, name: record.name, type: record.type });
          }
        }
      }
    }

    let credentialMappings: Record<string, string> = {};
    let credentialWarning: string | undefined;

    if (userCredentials.length === 0 && (template.required_credentials || []).length > 0) {
      // No credentials found at all - set warning
      credentialWarning = 'Could not verify credentials. You may need to configure credentials in n8n after import.';
    } else {
      // Check credential status
      const requiredCredentials = (template.required_credentials || []).map((c: any) => ({
        type: c.type,
        name: c.name,
        icon: c.icon || 'key',
        docUrl: c.docUrl || '',
        nodeTypes: c.nodeTypes || [],
      }));

      const credentialsWithStatus = checkCredentialStatus(requiredCredentials, userCredentials);
      const missingCredentials = getMissingCredentials(credentialsWithStatus);

      // If credentials are missing, add warning but allow import
      if (missingCredentials.length > 0) {
        const missingNames = missingCredentials.map(c => c.name).join(', ');
        credentialWarning = `Missing credentials: ${missingNames}. Configure them in the workflow after import.`;
      }

      // Build credential mappings (type -> actual credential ID)
      // Use user's selections if provided, otherwise use defaults
      for (const cred of credentialsWithStatus) {
        // Check if user made a specific selection for this credential type
        if (credentialSelections && credentialSelections[cred.type]) {
          credentialMappings[cred.type] = credentialSelections[cred.type];
        } else if (cred.existingCredentialId) {
          credentialMappings[cred.type] = cred.existingCredentialId;
        }
      }
    }

    // Prepare workflow for import
    const preparedWorkflow = prepareWorkflowForImport(
      template.workflow_json,
      credentialMappings
    );

    // Give the workflow a unique name to avoid conflicts
    preparedWorkflow.name = `${template.name} (imported ${new Date().toLocaleDateString()})`;

    // Ensure settings exist (required by n8n)
    preparedWorkflow.settings = preparedWorkflow.settings || {};

    // Generate fresh webhookIds for trigger nodes (n8n requires these)
    if (preparedWorkflow.nodes && Array.isArray(preparedWorkflow.nodes)) {
      for (const node of preparedWorkflow.nodes) {
        const isTrigger = node.type?.includes('Trigger') ||
                          node.type?.includes('trigger') ||
                          node.type?.includes('webhook') ||
                          node.type?.includes('Webhook');
        if (isTrigger) {
          node.webhookId = crypto.randomUUID();
          console.log(`[template-import] Generated webhookId for ${node.name}: ${node.webhookId}`);
        }
      }
    }

    // Fix missing typeVersion on critical nodes
    const typeVersionFix = fixNodeTypeVersions(preparedWorkflow);
    if (typeVersionFix.fixed > 0) {
      console.log('[template-import] Fixed typeVersions:', typeVersionFix.fixes);
    }

    // Remove read-only fields that n8n API rejects
    delete (preparedWorkflow as any).tags;
    delete (preparedWorkflow as any).id;
    delete (preparedWorkflow as any).createdAt;
    delete (preparedWorkflow as any).updatedAt;

    // Log the workflow being sent (for debugging)
    console.log('[template-import] Sending workflow to n8n:', {
      name: preparedWorkflow.name,
      nodeCount: preparedWorkflow.nodes?.length,
      hasConnections: !!preparedWorkflow.connections,
      hasSettings: !!preparedWorkflow.settings,
    });

    // Import workflow to n8n
    const importResult = await n8nFetch<{ id: string; name: string }>({
      instanceUrl: instance.instance_url,
      apiKey: instance.n8n_api_key,
      path: '/api/v1/workflows',
      method: 'POST',
      body: preparedWorkflow,
    });

    if (!importResult.success || !importResult.data) {
      console.error('[template-import] n8n import error:', {
        error: importResult.error,
        statusCode: importResult.statusCode,
        workflowName: preparedWorkflow.name,
        errorDetails: (importResult as any).data, // Include full error response from n8n
      });
      return NextResponse.json({
        success: false,
        error: importResult.error || 'Failed to import workflow to n8n',
        details: importResult.statusCode === 400
          ? `The workflow may contain invalid node configurations. n8n error: ${importResult.error}`
          : undefined,
      }, { status: 502 });
    }

    // Record the import with current template version
    await supabaseAdmin
      .from('workflow_template_imports')
      .insert({
        template_id: templateId,
        instance_id: instanceId,
        imported_by: user.id,
        n8n_workflow_id: importResult.data.id,
        status: 'imported',
        installed_version: template.version || 1, // Track which version was installed
      });

    return NextResponse.json({
      success: true,
      workflow_id: importResult.data.id,
      workflow_name: importResult.data.name,
      message: 'Workflow imported successfully. Activate it when you are ready.',
      ...(credentialWarning && { warning: credentialWarning }),
    });
  } catch (error) {
    console.error('Error in POST /api/client/templates/[id]/import:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
