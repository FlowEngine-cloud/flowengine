/**
 * Node Category Detector
 *
 * Dynamically detects node category based on workflow connections
 * NO HARDCODED NODE TYPES - uses only connection patterns
 */

export type NodeCategory = 'trigger' | 'regular' | 'aiTool' | 'aiModel' | 'aiMemory' | 'aiAgent' | 'unknown';

/**
 * Detect node category based on its connections in the workflow
 * Uses connection types, NOT node type strings
 */
export function detectNodeCategory(workflow: any, nodeName: string): NodeCategory {
  const connections = workflow.connections || {};
  const nodeConns = connections[nodeName];

  if (!nodeConns) {
    // No outgoing connections - check if it has incoming connections
    const hasInput = hasIncomingConnection(workflow, nodeName);
    return hasInput ? 'unknown' : 'trigger';
  }

  // Check output connection types to determine category
  if (nodeConns.ai_tool) return 'aiTool';
  if (nodeConns.ai_languageModel) return 'aiModel';
  if (nodeConns.ai_memory) return 'aiMemory';

  // Check if node type indicates it's an agent
  const node = workflow.nodes?.find((n: any) => n.name === nodeName);
  if (node && node.type === '@n8n/n8n-nodes-langchain.agent') {
    return 'aiAgent';
  }

  // Has main connections - check if it's a trigger (no incoming connections)
  if (nodeConns.main) {
    const hasInput = hasIncomingConnection(workflow, nodeName);
    if (!hasInput) return 'trigger';
    return 'regular';
  }

  return 'unknown';
}

/**
 * Check if a node has any incoming connections
 */
function hasIncomingConnection(workflow: any, targetNodeName: string): boolean {
  const connections = workflow.connections || {};

  for (const [sourceName, sourceConns] of Object.entries(connections)) {
    if (sourceName === targetNodeName) continue;

    const typedConns = sourceConns as any;
    for (const connectionType of Object.keys(typedConns)) {
      const outputs = typedConns[connectionType];
      if (!Array.isArray(outputs)) continue;

      for (const outputArray of outputs) {
        if (!Array.isArray(outputArray)) continue;

        for (const conn of outputArray) {
          if (conn.node === targetNodeName) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Map category to node registry category name
 */
export function getCategoryNodes(category: NodeCategory): string {
  switch (category) {
    case 'trigger': return 'triggers';
    case 'regular': return 'regularNodes';
    case 'aiTool': return 'aiTools';
    case 'aiModel': return 'aiModels';
    case 'aiMemory': return 'aiMemories';
    case 'aiAgent': return 'aiAgents';
    default: return 'regularNodes'; // Default fallback
  }
}
