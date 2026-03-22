/**
 * Template Update System
 * Handles preserving client configuration when agency updates templates
 */

import { supabaseAdmin as supabase } from '@/lib/supabaseAdmin';

/**
 * Node configuration snapshot
 */
export interface NodeConfigSnapshot {
  nodeName: string;
  nodeType: string;
  credentials: Record<string, { id: string; name: string }>;
  parameters: Record<string, any>;
}

/**
 * Template update info
 */
export interface TemplateUpdateInfo {
  hasUpdate: boolean;
  installedVersion: number;
  latestVersion: number;
  changelog: string | null;
  templateName: string;
  templateId: string;
}

/**
 * Extract configuration from a workflow's nodes
 * This captures credentials and parameters that need to be preserved
 */
export function extractNodeConfigs(workflowJson: any): NodeConfigSnapshot[] {
  const nodes = workflowJson?.nodes || [];
  const configs: NodeConfigSnapshot[] = [];

  for (const node of nodes) {
    // Skip utility nodes that don't have meaningful config
    const skipTypes = [
      'n8n-nodes-base.stickyNote',
      'n8n-nodes-base.noOp',
    ];
    if (skipTypes.some(t => node.type?.includes(t))) continue;

    // Extract credentials (if any)
    const credentials: Record<string, { id: string; name: string }> = {};
    if (node.credentials) {
      for (const [credType, credRef] of Object.entries(node.credentials as Record<string, any>)) {
        if (credRef?.id) {
          credentials[credType] = {
            id: credRef.id,
            name: credRef.name || '',
          };
        }
      }
    }

    // Extract parameters (filter out empty/default values)
    const parameters: Record<string, any> = {};
    if (node.parameters) {
      for (const [key, value] of Object.entries(node.parameters)) {
        // Skip empty values
        if (value === undefined || value === null || value === '') continue;
        // Skip default authentication values
        if (key === 'authentication') continue;
        // Keep everything else
        parameters[key] = value;
      }
    }

    // Only save if there's meaningful config
    if (Object.keys(credentials).length > 0 || Object.keys(parameters).length > 0) {
      configs.push({
        nodeName: node.name,
        nodeType: node.type,
        credentials,
        parameters,
      });
    }
  }

  return configs;
}

/**
 * Node detail for diff display
 */
export interface NodeDetail {
  name: string;
  type: string;
  hasCredentials: boolean;
  hasParameters: boolean;
  parameterCount: number;
}

/**
 * Node change detail for removed/changed nodes
 */
export interface NodeChangeDetail {
  nodeName: string;
  oldType?: string;
  newType?: string;
  changeType: 'removed' | 'type_changed';
}

/**
 * Apply saved configuration to a new workflow version
 * Matches nodes by name and type, then restores credentials and parameters
 */
export function applyNodeConfigs(
  workflowJson: any,
  savedConfigs: NodeConfigSnapshot[]
): {
  workflow: any;
  matched: string[];
  unmatched: string[];
  newNodes: string[];
  // New detailed info
  preservedNodes: NodeDetail[];
  addedNodes: NodeDetail[];
  changedNodes: NodeChangeDetail[];
} {
  const workflow = JSON.parse(JSON.stringify(workflowJson)); // Deep clone
  const nodes = workflow.nodes || [];

  const matched: string[] = [];
  const unmatched: string[] = [];
  const preservedNodes: NodeDetail[] = [];
  const changedNodes: NodeChangeDetail[] = [];
  const configMap = new Map(savedConfigs.map(c => [c.nodeName, c]));
  const matchedNames = new Set<string>();

  for (const node of nodes) {
    const savedConfig = configMap.get(node.name);

    if (savedConfig) {
      // Verify node type matches (in case node was replaced)
      if (savedConfig.nodeType === node.type) {
        // Restore credentials
        if (Object.keys(savedConfig.credentials).length > 0) {
          node.credentials = {
            ...node.credentials,
            ...savedConfig.credentials,
          };
        }

        // Restore parameters (merge with new defaults)
        if (Object.keys(savedConfig.parameters).length > 0) {
          node.parameters = {
            ...node.parameters,
            ...savedConfig.parameters,
          };
        }

        matched.push(node.name);
        matchedNames.add(node.name);

        // Add detailed info
        preservedNodes.push({
          name: node.name,
          type: node.type,
          hasCredentials: Object.keys(savedConfig.credentials).length > 0,
          hasParameters: Object.keys(savedConfig.parameters).length > 0,
          parameterCount: Object.keys(savedConfig.parameters).length,
        });
      } else {
        // Node type changed - can't safely restore
        unmatched.push(`${node.name} (type changed from ${savedConfig.nodeType} to ${node.type})`);
        changedNodes.push({
          nodeName: node.name,
          oldType: savedConfig.nodeType,
          newType: node.type,
          changeType: 'type_changed',
        });
      }
    }
  }

  // Find configs that weren't matched (nodes removed in new version)
  for (const config of savedConfigs) {
    if (!matchedNames.has(config.nodeName)) {
      unmatched.push(`${config.nodeName} (node removed in update)`);
      changedNodes.push({
        nodeName: config.nodeName,
        oldType: config.nodeType,
        changeType: 'removed',
      });
    }
  }

  // Find new nodes that might need configuration
  const existingNames = new Set(savedConfigs.map(c => c.nodeName));
  const newNodesFiltered = nodes
    .filter((n: any) => !existingNames.has(n.name))
    .filter((n: any) => {
      // Only flag nodes that typically need config
      const needsConfig = n.credentials ||
        (n.parameters && Object.keys(n.parameters).some(k =>
          k !== 'authentication' && k !== 'options'
        ));
      return needsConfig;
    });

  const newNodes = newNodesFiltered.map((n: any) => n.name);

  // Add detailed info for new nodes
  const addedNodes: NodeDetail[] = nodes
    .filter((n: any) => !existingNames.has(n.name))
    .map((n: any) => ({
      name: n.name,
      type: n.type,
      hasCredentials: !!(n.credentials && Object.keys(n.credentials).length > 0),
      hasParameters: !!(n.parameters && Object.keys(n.parameters).length > 0),
      parameterCount: n.parameters ? Object.keys(n.parameters).filter(k =>
        k !== 'authentication' && k !== 'options'
      ).length : 0,
    }));

  return {
    workflow,
    matched,
    unmatched,
    newNodes,
    preservedNodes,
    addedNodes,
    changedNodes,
  };
}

/**
 * Save node configurations to database
 * Uses upsert to avoid race conditions - configs are inserted/updated first,
 * then orphans (nodes that no longer exist) are cleaned up.
 */
export async function saveNodeConfigs(
  importId: string,
  configs: NodeConfigSnapshot[]
): Promise<{ success: boolean; error?: string }> {
  try {
    if (configs.length === 0) {
      // No configs to save - just delete any existing ones
      const { error: deleteError } = await supabase
        .from('template_node_configs')
        .delete()
        .eq('import_id', importId);

      if (deleteError) {
        console.error('[templateUpdates] Error deleting configs:', deleteError);
        return { success: false, error: deleteError.message };
      }
      return { success: true };
    }

    // Upsert configs (insert or update on conflict)
    // This ensures we don't lose data if there's a failure
    const { error: upsertError } = await supabase
      .from('template_node_configs')
      .upsert(
        configs.map(c => ({
          import_id: importId,
          node_name: c.nodeName,
          node_type: c.nodeType,
          credentials: c.credentials,
          parameters: c.parameters,
          updated_at: new Date().toISOString(),
        })),
        {
          onConflict: 'import_id,node_name',
          ignoreDuplicates: false,
        }
      );

    if (upsertError) {
      console.error('[templateUpdates] Error upserting configs:', upsertError);
      return { success: false, error: upsertError.message };
    }

    // Clean up orphan configs (nodes that were removed from the workflow)
    // Use a separate query to find and delete orphans safely
    const currentNodeNames = new Set(configs.map(c => c.nodeName));
    const { data: existingConfigs } = await supabase
      .from('template_node_configs')
      .select('id, node_name')
      .eq('import_id', importId);

    const orphanIds = (existingConfigs || [])
      .filter(c => !currentNodeNames.has(c.node_name))
      .map(c => c.id);

    if (orphanIds.length > 0) {
      const { error: cleanupError } = await supabase
        .from('template_node_configs')
        .delete()
        .in('id', orphanIds);

      if (cleanupError) {
        // Log but don't fail - the important data was saved
        console.warn('[templateUpdates] Warning: Error cleaning up orphan configs:', cleanupError);
      }
    }

    return { success: true };
  } catch (e: any) {
    console.error('[templateUpdates] Error saving configs:', e);
    return { success: false, error: e.message };
  }
}

/**
 * Load saved node configurations from database
 */
export async function loadNodeConfigs(
  importId: string
): Promise<{ configs: NodeConfigSnapshot[]; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('template_node_configs')
      .select('node_name, node_type, credentials, parameters')
      .eq('import_id', importId);

    if (error) {
      return { configs: [], error: error.message };
    }

    const configs: NodeConfigSnapshot[] = (data || []).map(row => ({
      nodeName: row.node_name,
      nodeType: row.node_type,
      credentials: row.credentials || {},
      parameters: row.parameters || {},
    }));

    return { configs };
  } catch (e: any) {
    return { configs: [], error: e.message };
  }
}

/**
 * Check if a workflow has an update available
 */
export async function checkWorkflowUpdate(
  importId: string
): Promise<TemplateUpdateInfo | null> {
  try {
    const { data, error } = await supabase
      .from('workflow_template_imports')
      .select(`
        id,
        installed_version,
        template_id,
        workflow_templates (
          id,
          name,
          version,
          changelog
        )
      `)
      .eq('id', importId)
      .single();

    if (error || !data || !data.workflow_templates) {
      return null;
    }

    const template = data.workflow_templates as any;
    const installedVersion = data.installed_version || 1;
    const latestVersion = template.version || 1;

    return {
      hasUpdate: latestVersion > installedVersion,
      installedVersion,
      latestVersion,
      changelog: template.changelog,
      templateName: template.name,
      templateId: template.id,
    };
  } catch (e) {
    console.error('[templateUpdates] Error checking update:', e);
    return null;
  }
}

/**
 * Get all updates available for an instance
 */
export async function getInstanceUpdates(
  instanceId: string
): Promise<{
  updates: Array<{
    importId: string;
    workflowId: string;
    templateName: string;
    installedVersion: number;
    latestVersion: number;
    changelog: string | null;
  }>;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('workflow_template_imports')
      .select(`
        id,
        n8n_workflow_id,
        installed_version,
        workflow_templates (
          id,
          name,
          version,
          changelog
        )
      `)
      .eq('instance_id', instanceId)
      .eq('status', 'imported');

    if (error) {
      return { updates: [], error: error.message };
    }

    const updates = (data || [])
      .filter(row => {
        const template = row.workflow_templates as any;
        if (!template) return false;
        const installed = row.installed_version || 1;
        const latest = template.version || 1;
        return latest > installed;
      })
      .map(row => {
        const template = row.workflow_templates as any;
        return {
          importId: row.id,
          workflowId: row.n8n_workflow_id,
          templateName: template.name,
          installedVersion: row.installed_version || 1,
          latestVersion: template.version || 1,
          changelog: template.changelog,
        };
      });

    return { updates };
  } catch (e: any) {
    return { updates: [], error: e.message };
  }
}

/**
 * Preview what will happen during an update
 * Shows which configs will be preserved, which might be lost
 */
export async function previewTemplateUpdate(
  importId: string,
  newWorkflowJson: any
): Promise<{
  success: boolean;
  preview?: {
    preserved: string[];      // Nodes with config that will be restored
    needsConfig: string[];    // New nodes that need configuration
    warnings: string[];       // Potential issues (type changes, removed nodes)
    preservedNodes: NodeDetail[];  // Detailed preserved node info
    addedNodes: NodeDetail[];      // Detailed added node info
    changedNodes: NodeChangeDetail[];  // Detailed changed/removed node info
  };
  error?: string;
}> {
  try {
    // Load saved configs
    const { configs, error } = await loadNodeConfigs(importId);
    if (error) {
      return { success: false, error };
    }

    // Apply to new workflow (dry run)
    const { matched, unmatched, newNodes, preservedNodes, addedNodes, changedNodes } = applyNodeConfigs(newWorkflowJson, configs);

    return {
      success: true,
      preview: {
        preserved: matched,
        needsConfig: newNodes,
        warnings: unmatched,
        preservedNodes,
        addedNodes,
        changedNodes,
      },
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * Perform the actual template update
 * 1. Extract current config from n8n workflow
 * 2. Apply new template
 * 3. Restore config
 * 4. Update n8n workflow
 */
export async function performTemplateUpdate(
  importId: string,
  instanceUrl: string,
  apiKey: string,
  newTemplateJson: any,
  newVersion: number
): Promise<{
  success: boolean;
  result?: {
    preserved: string[];
    needsConfig: string[];
    warnings: string[];
  };
  error?: string;
}> {
  try {
    // 1. Get import record
    const { data: importRecord, error: importError } = await supabase
      .from('workflow_template_imports')
      .select('n8n_workflow_id')
      .eq('id', importId)
      .single();

    if (importError || !importRecord) {
      return { success: false, error: 'Import record not found' };
    }

    // 2. Fetch current workflow from n8n
    const currentRes = await fetch(`${instanceUrl}/api/v1/workflows/${importRecord.n8n_workflow_id}`, {
      headers: { 'X-N8N-API-KEY': apiKey },
    });

    if (!currentRes.ok) {
      return { success: false, error: 'Failed to fetch current workflow' };
    }

    const currentWorkflow = await currentRes.json();

    // 3. Extract current configuration
    const configs = extractNodeConfigs(currentWorkflow);

    // 4. Save configs to database (backup)
    await saveNodeConfigs(importId, configs);

    // 5. Apply saved configs to new template
    const { workflow: updatedWorkflow, matched, unmatched, newNodes } =
      applyNodeConfigs(newTemplateJson, configs);

    // 6. Update workflow in n8n (preserve name and settings from current)
    const updateRes = await fetch(`${instanceUrl}/api/v1/workflows/${importRecord.n8n_workflow_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-N8N-API-KEY': apiKey,
      },
      body: JSON.stringify({
        name: currentWorkflow.name, // Keep user's name
        nodes: updatedWorkflow.nodes,
        connections: updatedWorkflow.connections,
        settings: { ...currentWorkflow.settings, ...updatedWorkflow.settings },
      }),
    });

    if (!updateRes.ok) {
      const errText = await updateRes.text();
      console.error('[templateUpdates] n8n update failed:', errText);
      return { success: false, error: 'Failed to update workflow in n8n' };
    }

    // 7. Update import record
    await supabase
      .from('workflow_template_imports')
      .update({
        installed_version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq('id', importId);

    return {
      success: true,
      result: {
        preserved: matched,
        needsConfig: newNodes,
        warnings: unmatched,
      },
    };
  } catch (e: any) {
    console.error('[templateUpdates] Error performing update:', e);
    return { success: false, error: e.message };
  }
}
