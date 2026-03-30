/**
 * Workflow Completion Engine
 * 
 * Auto-completes incomplete composite nodes by injecting required sub-nodes.
 * Like IDE auto-complete but for workflows.
 */

import { getCompositeTemplate, isCompositeNode } from './compositeNodes';

/**
 * n8n Workflow Node structure
 * IMPORTANT: Property order matters for n8n API import
 * Expected order: parameters, id, name, type, position, typeVersion
 */
interface Node {
  parameters?: any;
  id: string;
  name: string;
  type: string;
  position: [number, number];
  typeVersion?: number;
}

interface Workflow {
  nodes: Node[];
  connections: Record<string, any>;
}

/**
 * Auto-complete a workflow by adding missing sub-nodes for composite nodes
 * Fast, non-recursive, single-pass algorithm
 */
export function completeWorkflow(workflow: Workflow): {
  workflow: Workflow;
  additions: string[];
} {
  const additions: string[] = [];
  const newNodes: Node[] = [];
  const newConnections: Record<string, any> = { ...workflow.connections };
  const processedNodes = new Set<string>(); // Prevent infinite loops

  // Queue for breadth-first processing (prevents deep recursion)
  const queue: Node[] = [...workflow.nodes];
  const allNodes = new Set(workflow.nodes.map(n => n.name)); // Track all node names to prevent duplicates
  
  while (queue.length > 0) {
    const node = queue.shift()!;
    
    // Skip if already processed
    if (processedNodes.has(node.name)) continue;
    processedNodes.add(node.name);
    
    // Skip non-composite nodes
    if (!isCompositeNode(node.type)) continue;

    const template = getCompositeTemplate(node.type);
    if (!template) continue;

    // Check each required connection (fast - just checks existence)
    for (const required of template.requiredConnections) {
      const hasConnection = checkConnection(node.name, required.connectionType, newConnections);

      if (!hasConnection && required.isRequired) {
        // Find default sub-node for this connection type
        const defaultSubNode = template.defaultSubNodes?.find(
          sub => sub.connectionType === required.connectionType
        );

        if (defaultSubNode) {
          // Generate node name
          const typeName = defaultSubNode.nodeType.split('.').pop() || defaultSubNode.nodeType;
          const friendlyName = typeName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .trim();
          
          // Check if node with this name already exists (prevent duplicates)
          if (allNodes.has(friendlyName)) {
            console.log(`[WORKFLOW-COMPLETER] ⚠️ Node "${friendlyName}" already exists, skipping duplicate`);
            continue;
          }
          
          // Create the missing sub-node
          const subNode = createSubNode(
            defaultSubNode.nodeType,
            node,
            defaultSubNode.parameters || {}
          );
          
          allNodes.add(subNode.name); // Mark as created
          newNodes.push(subNode);
          additions.push(`${subNode.name} → ${node.name}`);

          // Create connection
          if (!newConnections[subNode.name]) {
            newConnections[subNode.name] = {};
          }
          if (!newConnections[subNode.name][required.connectionType]) {
            newConnections[subNode.name][required.connectionType] = [];
          }
          newConnections[subNode.name][required.connectionType].push([
            {
              node: node.name,
              type: required.connectionType,
              index: 0
            }
          ]);

          // Add sub-node to queue for processing (breadth-first)
          queue.push(subNode);
        }
      }
    }
  }

  return {
    workflow: {
      nodes: [...workflow.nodes, ...newNodes],
      connections: newConnections
    },
    additions
  };
}

/**
 * Check if a node has a specific connection type
 */
function checkConnection(
  nodeName: string,
  connectionType: string,
  connections: Record<string, any>
): boolean {
  // Check if ANY node connects to this node with the required connection type
  for (const [sourceName, sourceConns] of Object.entries(connections)) {
    if (sourceConns[connectionType]) {
      const conns = sourceConns[connectionType] as any[][];
      for (const connArray of conns) {
        for (const conn of connArray) {
          if (conn.node === nodeName) {
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Create a sub-node with appropriate naming and parameters
 */
function createSubNode(
  nodeType: string,
  parentNode: Node,
  defaultParams: Record<string, any>
): Node {
  // Generate friendly name based on node type
  const typeName = nodeType.split('.').pop() || nodeType;
  const friendlyName = typeName
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();

  // n8n expected property order: parameters, id, name, type, position, typeVersion
  return {
    parameters: defaultParams,
    id: `${parentNode.id}-${typeName.toLowerCase()}-${Date.now()}`,
    name: friendlyName,
    type: nodeType,
    position: [0, 0], // Will be positioned by validator
    typeVersion: getDefaultTypeVersion(nodeType)
  };
}

/**
 * Get default type version for a node type
 * CRITICAL: These must match n8n's expected versions
 */
function getDefaultTypeVersion(nodeType: string): number {
  // Common type versions for LangChain nodes (n8n v2.x+)
  if (nodeType.includes('chatTrigger')) return 1.4;
  if (nodeType.includes('agent')) return 3.1;
  if (nodeType.includes('memory') || nodeType.includes('memoryBufferWindow')) return 1.3;
  if (nodeType.includes('vectorStore')) return 1.3;
  if (nodeType.includes('embeddings')) return 1;
  if (nodeType.includes('lmChat')) return 1.2;
  if (nodeType === 'CUSTOM.flowEngineLlm') return 1;
  return 1;
}
