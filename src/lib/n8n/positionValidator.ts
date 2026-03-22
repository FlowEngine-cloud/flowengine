/**
 * Enhanced Position Validator for AI Agent Workflows
 *
 * FUNDAMENTAL LAYOUT PRINCIPLE:
 * - Main flow nodes (triggers, agents, actions): HORIZONTAL LINE at Y = MAIN_Y
 * - Sub-nodes (models, memory, tools): VERTICAL STACKS BELOW their parent at Y = SUB_Y
 * - Consistent spacing between all nodes
 *
 * Layout pattern (inspired by working simple workflows):
 * ┌─────────────────────────────────────────────────────────────┐
 * │  [Trigger] → [Agent1] → [Action] → [Agent2] → [Action]      │  ← Main flow (Y = -208)
 * │               ↓                      ↓                        │
 * │            [Model]                [Model]                     │  ← Sub-nodes (Y = 0 or -16)
 * │            [Memory]               [Memory]                    │
 * │            [Tools]                [Tools]                     │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Spacing constants (from organized workflow analysis):
 * - Trigger → Agent: 176px
 * - Agent → Next node: 320px
 * - Sub-nodes: Vertically stacked with 16px offset
 * - All main flow: Same Y coordinate
 * - All sub-nodes: Same Y coordinate (offset below main)
 */

import {
  detectWorkflowPattern,
  WorkflowPattern,
  WorkflowContext,
} from './workflowPatternDetector';

/**
 * n8n Workflow Node structure (minimal for positioning)
 * IMPORTANT: When creating full nodes, use property order:
 * parameters, id, name, type, position, typeVersion
 */
interface Node {
  name: string;
  type: string;
  position: [number, number];
}

interface Workflow {
  nodes: Node[];
  connections: Record<string, any>;
}

// FUNDAMENTAL LAYOUT CONSTANTS (from organized workflow analysis)
const MAIN_FLOW_Y = -112;       // Y coordinate for ALL main flow nodes (triggers, agents, actions)
const SUB_NODE_Y = 80;          // Y coordinate for ALL sub-nodes (models, memory, tools)
const TRIGGER_START_X = -144;   // Starting X for trigger
const NODE_SPACING = 240;       // Horizontal spacing between consecutive main flow nodes
const POST_AGENT_SPACING = 304; // Spacing after an agent node (more space for sub-nodes visibility)
const SUB_NODE_SPACING = 160;   // Horizontal spacing between sub-nodes
const MODEL_MEMORY_OFFSET = -64; // X offset for model relative to parent
const MEMORY_OFFSET = 96;       // X offset for memory relative to parent

/**
 * Check if a node is a specific type
 */
function isMemoryNode(node: Node): boolean {
  return node.type.includes('memory');
}

function isChatModelNode(node: Node): boolean {
  return node.type.includes('lmChat') ||
         node.type.includes('ChatModel') ||
         node.type.includes('flowEngineLlm') ||
         node.type.startsWith('CUSTOM.');
}

function isToolNode(node: Node): boolean {
  // AI tool nodes end with 'Tool' (capital T) or start with 'tool' (lowercase t)
  const isTool = node.type.endsWith('Tool') || node.type.includes('.tool');
  return isTool;
}

function isTriggerNode(node: Node): boolean {
  return node.type.includes('rigger') || node.type.includes('manual');
}

/**
 * Validate and fix node positions for AI agent workflows (pattern-aware)
 * Uses a 2-pass algorithm for clean horizontal layouts:
 * 1. Build main flow chain
 * 2. Position all nodes on consistent Y coordinates
 */
export function validateAndFixPositions(workflow: Workflow): Workflow {
  console.log('🔧 Position validator called with', workflow.nodes?.length, 'nodes');

  if (!workflow.nodes || workflow.nodes.length === 0) {
    return workflow;
  }

  const nodes = [...workflow.nodes];
  const connections = workflow.connections || {};

  // Build main flow chain starting from trigger
  const mainFlowChain = buildMainFlowChain(nodes, connections);
  console.log(`📊 Main flow chain has ${mainFlowChain.length} nodes`);

  // Position main flow nodes on horizontal line
  let currentX = TRIGGER_START_X;
  const processedNodes = new Set<string>();

  mainFlowChain.forEach((node, index) => {
    node.position = [currentX, MAIN_FLOW_Y];
    processedNodes.add(node.name);
    console.log(`📍 Positioned "${node.name}" at [${currentX}, ${MAIN_FLOW_Y}]`);

    // Position sub-nodes for this node
    const subNodes = findSubNodes(nodes, node, connections);
    const hasSubNodes = subNodes.length > 0;
    positionSubNodesBelow(node, subNodes, currentX);
    subNodes.forEach(sub => processedNodes.add(sub.name));

    // Use POST_AGENT_SPACING after nodes with sub-nodes (agents), NODE_SPACING for others
    currentX += hasSubNodes ? POST_AGENT_SPACING : NODE_SPACING;
  });

  // Handle any unprocessed nodes (shouldn't happen in valid workflows)
  nodes.forEach(node => {
    if (!processedNodes.has(node.name)) {
      console.warn(`⚠️  Unprocessed node: "${node.name}" - positioning at end`);
      node.position = [currentX, MAIN_FLOW_Y];
      currentX += NODE_SPACING;
    }
  });

  return {
    ...workflow,
    nodes
  };
}

/**
 * Build the main flow chain starting from trigger or first node
 * Returns nodes in execution order
 *
 * NOW SUPPORTS ALL PATTERNS:
 * - Linear chains (Agent1 → Agent2 → Agent3)
 * - Branches (IF node → path A, path B)
 * - Loops (Critic → back to Generator)
 * - Parallel (Trigger → [Agent1, Agent2, Agent3] → Merge)
 */
function buildMainFlowChain(nodes: Node[], connections: Record<string, any>): Node[] {
  const chain: Node[] = [];
  const visited = new Set<string>();

  // Find starting node (trigger or first node)
  let startNode = nodes.find(n => isTriggerNode(n));
  if (!startNode) {
    // No trigger - find node with no incoming main connections
    const nodesWithIncoming = new Set<string>();
    for (const [sourceName, conns] of Object.entries(connections)) {
      if (conns.main) {
        (conns.main as any[][]).forEach(connArray => {
          connArray.forEach(conn => nodesWithIncoming.add(conn.node));
        });
      }
    }
    startNode = nodes.find(n => !nodesWithIncoming.has(n.name));
  }

  if (!startNode) {
    console.warn('⚠️  No start node found, using first node');
    startNode = nodes[0];
  }

  // Use BFS to collect ALL connected nodes (handles branches, loops, parallel)
  const queue: Node[] = [startNode];
  const nodeOrder: Node[] = []; // Tracks order for positioning

  while (queue.length > 0) {
    const currentNode = queue.shift()!;

    // Skip if already processed
    if (visited.has(currentNode.name)) {
      continue;
    }

    visited.add(currentNode.name);

    // Add to chain if it's a main node (not a sub-node)
    if (!isSubNode(currentNode)) {
      chain.push(currentNode);
      nodeOrder.push(currentNode);
    }

    // Find ALL next nodes (not just first - handles branches and parallel)
    const nextNodes = findAllNextMainNodes(nodes, currentNode, connections);
    queue.push(...nextNodes);
  }

  return chain;
}

/**
 * Check if a node is a sub-node (AI helper: model, memory, tool)
 */
function isSubNode(node: Node): boolean {
  return isMemoryNode(node) || isChatModelNode(node) || isToolNode(node);
}

/**
 * Find ALL next nodes in the main flow (handles branches, parallel, loops)
 * Returns array of all nodes this node connects to via main connections
 */
function findAllNextMainNodes(nodes: Node[], currentNode: Node, connections: Record<string, any>): Node[] {
  const conns = connections[currentNode.name];
  if (!conns || !conns.main) {
    return [];
  }

  const nextNodes: Node[] = [];
  const mainConns = conns.main as any[][];

  // Iterate through ALL connection arrays (handles branches and parallel)
  for (const connArray of mainConns) {
    for (const conn of connArray) {
      const targetNode = nodes.find(n => n.name === conn.node);
      if (targetNode) {
        nextNodes.push(targetNode);
      }
    }
  }

  return nextNodes;
}

/**
 * Find all sub-nodes connected to a parent node
 */
function findSubNodes(nodes: Node[], parentNode: Node, connections: Record<string, any>): Node[] {
  const subNodes: Node[] = [];

  console.log(`  🔍 Finding sub-nodes for parent "${parentNode.name}"`);

  // Find nodes that connect TO this parent via AI connections
  for (const [sourceName, sourceConns] of Object.entries(connections)) {
    for (const [outputType, outputs] of Object.entries(sourceConns)) {
      if (outputType.startsWith('ai_')) {
        console.log(`    🔗 Checking ${outputType} connection from "${sourceName}"`);
        const conns = outputs as any[][];
        for (const connArray of conns) {
          for (const conn of connArray) {
            console.log(`      → targets: "${conn.node}"`);
            if (conn.node === parentNode.name) {
              const subNode = nodes.find(n => n.name === sourceName);
              if (subNode && isSubNode(subNode)) {
                console.log(`      ✅ Found sub-node "${sourceName}" (${subNode.type})`);
                subNodes.push(subNode);
              } else if (subNode) {
                console.log(`      ❌ "${sourceName}" is not recognized as sub-node (type: ${subNode.type})`);
              }
            }
          }
        }
      }
    }
  }

  console.log(`  📦 Found ${subNodes.length} sub-nodes for "${parentNode.name}"`);
  return subNodes;
}

/**
 * Position sub-nodes below their parent in a clean vertical stack
 */
function positionSubNodesBelow(parentNode: Node, subNodes: Node[], parentX: number): void {
  if (subNodes.length === 0) return;

  // Separate by type
  const models = subNodes.filter(n => isChatModelNode(n));
  const memories = subNodes.filter(n => isMemoryNode(n));
  const tools = subNodes.filter(n => isToolNode(n));

  console.log(`  └─ Sub-nodes: ${models.length} model(s), ${memories.length} memory, ${tools.length} tool(s)`);

  // Position models on the left
  models.forEach((node, index) => {
    const xPos = parentX + MODEL_MEMORY_OFFSET - (index * SUB_NODE_SPACING);
    node.position = [xPos, SUB_NODE_Y];
    console.log(`     📊 Model "${node.name}" at [${xPos}, ${SUB_NODE_Y}]`);
  });

  // Position memories on the right
  memories.forEach((node, index) => {
    const xPos = parentX + MEMORY_OFFSET + (index * SUB_NODE_SPACING);
    node.position = [xPos, SUB_NODE_Y];
    console.log(`     💾 Memory "${node.name}" at [${xPos}, ${SUB_NODE_Y}]`);
  });

  // Position tools on same row as models/memory, but further to the right
  tools.forEach((node, index) => {
    const xPos = parentX + MEMORY_OFFSET + SUB_NODE_SPACING + (index * SUB_NODE_SPACING);
    node.position = [xPos, SUB_NODE_Y];
    console.log(`     🔧 Tool "${node.name}" at [${xPos}, ${SUB_NODE_Y}]`);
  });
}

