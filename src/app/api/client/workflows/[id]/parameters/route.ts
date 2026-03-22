import { NextRequest, NextResponse } from 'next/server';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET: Fetch workflow node parameters
export async function GET(
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

    // Get instanceId from query params
    const url = new URL(req.url);
    const instanceId = url.searchParams.get('instanceId');

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

    // Fetch workflow from n8n
    const workflowResponse = await fetch(`${instance.instance_url}/api/v1/workflows/${workflowId}`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': instance.n8n_api_key,
      },
    });

    if (!workflowResponse.ok) {
      if (workflowResponse.status === 404) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 400 });
    }

    const workflow = await workflowResponse.json();

    // Fetch node type info for each unique node type in the workflow
    // Skip FlowEngine nodes - keep as text inputs
    const nodeTypeInfo: Record<string, any> = {};
    const uniqueNodeTypes = new Set<string>();

    for (const node of (workflow.nodes || [])) {
      if (node.type && !node.type.toLowerCase().includes('flowengine')) {
        uniqueNodeTypes.add(node.type);
      }
    }

    // Fetch node type definitions in parallel
    await Promise.all(
      Array.from(uniqueNodeTypes).map(async (nodeType) => {
        try {
          const nodeTypeResponse = await fetch(
            `${instance.instance_url}/api/v1/node-types/${encodeURIComponent(nodeType)}`,
            {
              method: 'GET',
              headers: {
                'X-N8N-API-KEY': instance.n8n_api_key,
              },
            }
          );

          if (nodeTypeResponse.ok) {
            const nodeTypeDef = await nodeTypeResponse.json();
            nodeTypeInfo[nodeType] = nodeTypeDef;
          }
        } catch (error) {
          // Ignore errors - fallback to dynamic extraction
          console.log(`[WARN] Failed to fetch node type: ${nodeType}`);
        }
      })
    );

    // Return workflow data with nodes and node type info
    const response: any = {
      workflowId: workflow.id,
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      nodeTypeInfo: Object.keys(nodeTypeInfo).length > 0 ? nodeTypeInfo : undefined,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Fetch workflow parameters error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update workflow node parameters
export async function PATCH(
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

    const { nodeId, parameters, instanceId } = body;

    // Validate parameters
    if (!nodeId || typeof nodeId !== 'string') {
      return NextResponse.json({ error: 'Node ID is required' }, { status: 400 });
    }

    if (!parameters || typeof parameters !== 'object') {
      return NextResponse.json({ error: 'Parameters object is required' }, { status: 400 });
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
        // Fetch instance details for agency-owned
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

    // Validate instance is active and not deleted
    if (instance.deleted_at) {
      return NextResponse.json({ error: 'Instance is no longer available' }, { status: 404 });
    }

    if (instance.subscription_status !== 'active' && instance.subscription_status !== 'trialing') {
      return NextResponse.json({ error: 'Instance subscription is not active' }, { status: 403 });
    }

    // Fetch current workflow from n8n
    const workflowResponse = await fetch(`${instance.instance_url}/api/v1/workflows/${workflowId}`, {
      method: 'GET',
      headers: {
        'X-N8N-API-KEY': instance.n8n_api_key,
      },
    });

    if (!workflowResponse.ok) {
      if (workflowResponse.status === 404) {
        return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Failed to fetch workflow' }, { status: 400 });
    }

    const workflow = await workflowResponse.json();

    // Validate workflow has nodes
    if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
      return NextResponse.json({ error: 'Workflow has no nodes' }, { status: 400 });
    }

    // Find and update the node
    const nodeIndex = workflow.nodes.findIndex((n: any) => n.id === nodeId);
    if (nodeIndex === -1) {
      return NextResponse.json({ error: 'Node not found in workflow' }, { status: 404 });
    }

    // Forbidden keys to prevent prototype pollution attacks
    const FORBIDDEN_KEYS = ['__proto__', 'constructor', 'prototype'];

    // Helper function to set nested values (e.g., "options.folderId" -> node.parameters.options.folderId)
    const setNestedValue = (obj: any, path: string, value: any): boolean => {
      const parts = path.split('.');
      // Check for prototype pollution attempts
      if (parts.some(p => FORBIDDEN_KEYS.includes(p))) {
        return false; // Reject this key
      }
      let current = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        if (!(parts[i] in current)) {
          current[parts[i]] = {};
        }
        current = current[parts[i]];
      }
      current[parts[parts.length - 1]] = value;
      return true;
    };

    // Validate all parameter keys before applying
    for (const key of Object.keys(parameters)) {
      const keyParts = key.split('.');
      if (keyParts.some(p => FORBIDDEN_KEYS.includes(p))) {
        return NextResponse.json({ error: `Invalid parameter key: ${key}` }, { status: 400 });
      }
    }

    // Store the workflow versionId for race condition detection
    const originalVersionId = workflow.versionId;

    // Merge new parameters with existing ones, handling nested paths
    const nodeParams = workflow.nodes[nodeIndex].parameters || {};
    for (const [key, value] of Object.entries(parameters)) {
      if (key.includes('.')) {
        // Nested path like "options.folderId"
        setNestedValue(nodeParams, key, value);
      } else {
        // Simple top-level parameter
        nodeParams[key] = value;
      }
    }
    workflow.nodes[nodeIndex].parameters = nodeParams;

    // Update workflow in n8n
    // Note: Only include properties that n8n accepts in PUT /workflows/{id}
    // Do NOT include versionId, id, createdAt, updatedAt, active, etc. as they cause "additional properties" error
    const updatePayload: Record<string, any> = {
      name: workflow.name,
      nodes: workflow.nodes,
      connections: workflow.connections,
      settings: workflow.settings,
      staticData: workflow.staticData,
    };

    const updateResponse = await fetch(`${instance.instance_url}/api/v1/workflows/${workflowId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': instance.n8n_api_key,
      },
      body: JSON.stringify(updatePayload),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('n8n API error updating workflow:', errorText);

      let errorMessage = 'Failed to update workflow';
      if (updateResponse.status === 400) {
        try {
          const parsed = JSON.parse(errorText);
          errorMessage = parsed.message || 'Invalid workflow configuration';
        } catch {
          errorMessage = 'Invalid workflow configuration';
        }
      }

      // Check if it's a version conflict (concurrent edit)
      if (errorText.includes('version') || errorText.includes('conflict')) {
        return NextResponse.json({
          error: 'Workflow was modified by another user. Please refresh and try again.',
          code: 'CONFLICT'
        }, { status: 409 });
      }

      return NextResponse.json({ error: errorMessage }, { status: updateResponse.status >= 500 ? 500 : updateResponse.status });
    }

    const updatedWorkflow = await updateResponse.json();

    // Warn if version jumped unexpectedly (indicates concurrent modification)
    const versionWarning = originalVersionId && updatedWorkflow.versionId &&
      updatedWorkflow.versionId !== originalVersionId + 1
        ? 'Warning: Workflow may have been modified concurrently'
        : undefined;

    return NextResponse.json({
      success: true,
      nodeId,
      nodeName: workflow.nodes[nodeIndex].name,
      parameters: workflow.nodes[nodeIndex].parameters,
      ...(versionWarning && { warning: versionWarning }),
    });
  } catch (error) {
    console.error('Update workflow parameters error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
