/**
 * 4-Layer Structural Validator for n8n Workflows
 *
 * Ensures AI-generated workflows are 100% structurally valid before execution.
 *
 * Validation Layers:
 * 1. Node Type Validation - Verify all node types exist in registry
 * 2. Port & Connection Type Validation - Ensure correct port types for connections
 * 3. Required Sub-Node Validation - Check mandatory dependencies (agent needs model, etc.)
 * 4. Position Validation - Detect overlaps and enforce hierarchical positioning
 */

import { isValidNodeType, suggestNodeType } from './nodeRegistry';
import { categorizeNode, getRequiredSubNodes, NodeCategory } from './nodeCategories';
import {
  getPortCapabilities,
  canOutputOnPort,
  canAcceptInputOnPort,
  getValidOutputPorts,
  isAIPort
} from './portCapabilities';
import { isStartingNode } from './workflowConstants';

// ========================================
// TYPES
// ========================================

interface Node {
  id?: string;
  name: string;
  type: string;
  position?: [number, number];
  parameters?: any;
}

interface ConnectionRef {
  node: string;
  type: string;
  index: number;
}

type ConnectionMatrix = Record<string, ConnectionRef[][]>;
type ConnectionMap = Record<string, ConnectionMatrix>;

interface Workflow {
  nodes: Node[];
  connections?: ConnectionMap;
  settings?: any;
}

export interface ValidationOptions {
  /** Auto-fix fixable issues (default: true) */
  autofix?: boolean;
  /** Fail on warnings too (default: false) */
  strict?: boolean;
  /** Skip position validation - useful when analyzing user workflows (default: false) */
  skipPositionValidation?: boolean;
}

export interface ValidationResult {
  /** Overall validation status */
  valid: boolean;
  /** Critical issues that prevent execution */
  errors: string[];
  /** Non-critical issues (conventions, best practices) */
  warnings: string[];
  /** List of autofixes applied */
  fixes: string[];
  /** Auto-fixed workflow (if autofix enabled) */
  normalized?: Workflow;
  /** Detailed validation results per layer */
  details: {
    layer1_node_types: LayerResult;
    layer2_connections: LayerResult;
    layer3_required_nodes: LayerResult;
    layer4_positions: LayerResult;
  };
}

interface LayerResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
  fixes: string[];
}

// ========================================
// CONSTANTS
// ========================================

const NODE_DIMENSIONS = { width: 200, height: 100 };
const MIN_SPACING = { x: 50, y: 50 };
const CANVAS_BOUNDS = {
  min: [-10000, -10000],
  max: [10000, 10000],
  recommendedStart: [100, 250]
};

// ========================================
// MAIN VALIDATOR FUNCTION
// ========================================

/**
 * Validate n8n workflow structure across all 4 layers
 */
export function validateStructure(
  workflow: Workflow,
  options: ValidationOptions = {}
): ValidationResult {
  const { autofix = true, strict = false, skipPositionValidation = false } = options;

  // Clone workflow if autofix enabled
  const workingWorkflow = autofix ? cloneWorkflow(workflow) : workflow;

  // Run validation layers
  const layer1 = validateLayer1_NodeTypes(workingWorkflow, autofix);
  const layer2 = validateLayer2_Connections(workingWorkflow, autofix);
  const layer3 = validateLayer3_RequiredNodes(workingWorkflow, autofix);

  // Skip position validation when analyzing user workflows (positions are irrelevant)
  const layer4 = skipPositionValidation
    ? { passed: true, errors: [], warnings: [], fixes: [] }
    : validateLayer4_Positions(workingWorkflow, autofix);

  // Aggregate results
  const allErrors = [
    ...layer1.errors,
    ...layer2.errors,
    ...layer3.errors,
    ...layer4.errors
  ];

  const allWarnings = [
    ...layer1.warnings,
    ...layer2.warnings,
    ...layer3.warnings,
    ...layer4.warnings
  ];

  const allFixes = [
    ...layer1.fixes,
    ...layer2.fixes,
    ...layer3.fixes,
    ...layer4.fixes
  ];

  // Determine if valid
  const hasErrors = allErrors.length > 0;
  const hasWarnings = allWarnings.length > 0;
  const valid = !hasErrors && (!strict || !hasWarnings);

  return {
    valid,
    errors: allErrors,
    warnings: allWarnings,
    fixes: allFixes,
    normalized: autofix ? workingWorkflow : undefined,
    details: {
      layer1_node_types: layer1,
      layer2_connections: layer2,
      layer3_required_nodes: layer3,
      layer4_positions: layer4
    }
  };
}

// ========================================
// LAYER 1: NODE TYPE VALIDATION
// ========================================

function validateLayer1_NodeTypes(workflow: Workflow, autofix: boolean): LayerResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: string[] = [];

  for (const node of workflow.nodes) {
    // Check required fields
    if (!node.name) {
      errors.push(`Node missing 'name' field`);
      continue;
    }

    if (!node.type) {
      errors.push(`Node '${node.name}' missing 'type' field`);
      continue;
    }

    // Validate node type exists
    if (!isValidNodeType(node.type)) {
      const suggestion = suggestNodeType(node.type);
      if (autofix && suggestion && suggestion !== node.type) {
        node.type = suggestion;
        fixes.push(`Corrected node type '${node.name}': invalid → ${suggestion}`);
      } else {
        errors.push(`Invalid node type '${node.type}' for node '${node.name}'`);
      }
    }

    // CRITICAL: NEVER generate id - n8n auto-generates this
    // Removed id generation to prevent import issues

    // Add default position if missing
    if (!node.position && autofix) {
      node.position = [CANVAS_BOUNDS.recommendedStart[0], CANVAS_BOUNDS.recommendedStart[1]];
      fixes.push(`Added default position for node '${node.name}'`);
    }

    // Check required parameters field exists
    if (!node.parameters && autofix) {
      node.parameters = {};
      fixes.push(`Added empty parameters object for node '${node.name}'`);
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    fixes
  };
}

// ========================================
// LAYER 2: PORT & CONNECTION TYPE VALIDATION
// ========================================

function validateLayer2_Connections(workflow: Workflow, autofix: boolean): LayerResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: string[] = [];

  if (!workflow.connections) {
    return { passed: true, errors, warnings, fixes };
  }

  const nodeMap = new Map(workflow.nodes.map(n => [n.name, n]));

  for (const [sourceName, outputMap] of Object.entries(workflow.connections)) {
    const sourceNode = nodeMap.get(sourceName);
    if (!sourceNode) {
      errors.push(`Connection references non-existent source node: '${sourceName}'`);
      continue;
    }

    for (const [portType, connectionArrays] of Object.entries(outputMap)) {
      // Check for empty connection arrays [[]]
      for (let i = 0; i < connectionArrays.length; i++) {
        const connArray = connectionArrays[i];
        if (Array.isArray(connArray) && connArray.length === 0) {
          if (autofix) {
            // Remove empty array
            connectionArrays.splice(i, 1);
            i--;
            fixes.push(`Removed empty connection array for node '${sourceName}' on port '${portType}'`);
          } else {
            errors.push(`Node '${sourceName}' has empty connection array [[]] on port '${portType}'`);
          }
          continue;
        }

        // Validate each connection in the array
        for (const conn of connArray) {
          // Check target node exists
          const targetNode = nodeMap.get(conn.node);
          if (!targetNode) {
            errors.push(`Connection from '${sourceName}' references non-existent target node: '${conn.node}'`);
            continue;
          }

          // Validate source can output on this port type
          if (!canOutputOnPort(sourceNode.type, portType)) {
            const validPorts = getValidOutputPorts(sourceNode.type);
            errors.push(
              `Node '${sourceName}' (type: ${sourceNode.type}) cannot output on port '${portType}'. Valid ports: [${validPorts.join(', ')}]`
            );
          }

          // Validate target can accept this port type
          if (!canAcceptInputOnPort(targetNode.type, portType)) {
            // This is a warning, not error (target might just not be configured yet)
            warnings.push(
              `Node '${conn.node}' (type: ${targetNode.type}) may not accept input on port '${portType}'`
            );
          }

          // Validate connection type matches port type
          if (conn.type !== portType) {
            if (autofix) {
              conn.type = portType;
              fixes.push(`Corrected connection type for ${sourceName} → ${conn.node}: '${conn.type}' → '${portType}'`);
            } else {
              warnings.push(
                `Connection ${sourceName} → ${conn.node} has mismatched types: connection.type='${conn.type}' but port='${portType}'`
              );
            }
          }
        }
      }

      // Clean up port if all connections removed
      if (autofix && connectionArrays.length === 0) {
        delete outputMap[portType];
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    fixes
  };
}

// ========================================
// LAYER 3: REQUIRED SUB-NODE VALIDATION
// ========================================

function validateLayer3_RequiredNodes(workflow: Workflow, autofix: boolean): LayerResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: string[] = [];

  if (!workflow.connections) {
    // No connections means we can't validate dependencies
    // This is handled by layer 2
    return { passed: true, errors, warnings, fixes };
  }

  const nodeMap = new Map(workflow.nodes.map(n => [n.name, n]));

  // Build reverse connection map (node → what connects to it)
  const incomingConnections = new Map<string, Array<{ from: string; port: string }>>();

  for (const [sourceName, outputMap] of Object.entries(workflow.connections)) {
    for (const [portType, connectionArrays] of Object.entries(outputMap)) {
      for (const connArray of connectionArrays) {
        for (const conn of connArray) {
          if (!incomingConnections.has(conn.node)) {
            incomingConnections.set(conn.node, []);
          }
          incomingConnections.get(conn.node)!.push({
            from: sourceName,
            port: portType
          });
        }
      }
    }
  }

  // Check each node for required sub-nodes
  for (const node of workflow.nodes) {
    const requiredSubNodes = getRequiredSubNodes(node.type);
    if (requiredSubNodes.length === 0) continue;

    const incoming = incomingConnections.get(node.name) || [];

    for (const requirement of requiredSubNodes) {
      if (!requirement.required) {
        // Optional sub-node - only warn if missing
        const hasConnection = incoming.some(conn => conn.port === requirement.connection);
        if (!hasConnection) {
          warnings.push(
            `Node '${node.name}' (${node.type}) missing optional ${requirement.category}: ${requirement.description}`
          );
        }
      } else {
        // Required sub-node - error if missing
        const hasConnection = incoming.some(conn => conn.port === requirement.connection);
        if (!hasConnection) {
          errors.push(
            `Node '${node.name}' (${node.type}) missing required ${requirement.category} on port '${requirement.connection}': ${requirement.description}`
          );
        }
      }
    }

    // Special case: AI Agent - additional warnings for optional features
    if (node.type === '@n8n/n8n-nodes-langchain.agent') {
      const hasMemory = incoming.some(conn => conn.port === 'ai_memory');
      const hasTools = incoming.some(conn => conn.port === 'ai_tool');

      if (!hasMemory) {
        warnings.push(`AI Agent '${node.name}' has no memory - conversations won't persist across interactions`);
      }

      if (!hasTools) {
        warnings.push(`AI Agent '${node.name}' has no tools - agent will have limited capabilities`);
      }
      // Note: Model requirement is handled by generic requiredSubNodes loop
    }

    // Special case: Vector Store Tool needs vector store
    if (node.type === '@n8n/n8n-nodes-langchain.toolVectorStore') {
      const hasVectorStore = incoming.some(conn => conn.port === 'ai_vectorStore');
      if (!hasVectorStore) {
        errors.push(`Vector Store Tool '${node.name}' missing required vector store connection (ai_vectorStore)`);
      }
    }

    // Special case: Vector Stores need embeddings (unless retrieve-only mode)
    if (node.type.includes('vectorStore') && !node.type.includes('Tool')) {
      const hasEmbeddings = incoming.some(conn => conn.port === 'ai_embedding');
      if (!hasEmbeddings) {
        // Check if this is retrieve-only mode
        const mode = node.parameters?.mode;
        if (mode !== 'load' && mode !== 'retrieve') {
          errors.push(`Vector Store '${node.name}' missing required embeddings connection (ai_embedding)`);
        }
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    fixes
  };
}

// ========================================
// LAYER 4: POSITION VALIDATION
// ========================================

/**
 * Position nodes from the same source vertically (stacked)
 * When a node has multiple outputs (e.g., router/switch), position them vertically
 */
function positionNodesFromSameSource(workflow: Workflow, fixes: string[]): void {
  if (!workflow.connections) return;

  // Build map: source node → list of target nodes
  const sourceToTargets = new Map<string, Array<{ name: string; node: Node }>>();

  for (const [sourceName, outputMap] of Object.entries(workflow.connections)) {
    const targets: Array<{ name: string; node: Node }> = [];

    for (const [_, connectionArrays] of Object.entries(outputMap)) {
      for (const connArray of connectionArrays) {
        for (const conn of connArray) {
          const targetNode = workflow.nodes.find(n => n.name === conn.node);
          if (targetNode && targetNode.position) {
            targets.push({ name: conn.node, node: targetNode });
          }
        }
      }
    }

    if (targets.length > 1) {
      sourceToTargets.set(sourceName, targets);
    }
  }

  // For each source with multiple targets, stack them vertically
  for (const [sourceName, targets] of sourceToTargets.entries()) {
    const sourceNode = workflow.nodes.find(n => n.name === sourceName);
    if (!sourceNode || !sourceNode.position) continue;

    const [sourceX, sourceY] = sourceNode.position;

    // Calculate positions: same X (source + spacing), different Y (stacked)
    const outputX = sourceX + NODE_DIMENSIONS.width + MIN_SPACING.x + 210; // Extra spacing for clarity
    const verticalSpacing = 160;
    const numTargets = targets.length;

    // Center the vertical spread around source Y
    const totalHeight = (numTargets - 1) * verticalSpacing;
    const startY = sourceY - (totalHeight / 2);

    // Position each target node
    targets.forEach((target, index) => {
      const newY = startY + (index * verticalSpacing);
      target.node.position = [outputX, newY];
      fixes.push(`Positioned '${target.name}' vertically from '${sourceName}' at [${outputX}, ${newY}]`);
    });
  }
}

function validateLayer4_Positions(workflow: Workflow, autofix: boolean): LayerResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: string[] = [];

  if (workflow.nodes.length === 0) {
    return { passed: true, errors, warnings, fixes };
  }

  // Ensure all nodes have positions
  for (const node of workflow.nodes) {
    if (!node.position && autofix) {
      node.position = [CANVAS_BOUNDS.recommendedStart[0], CANVAS_BOUNDS.recommendedStart[1]];
      fixes.push(`Added default position for node '${node.name}'`);
    }
  }

  // 4A-NEW: Position nodes from same source vertically (e.g., router outputs)
  if (autofix && workflow.connections) {
    positionNodesFromSameSource(workflow, fixes);
  }

  // 4A: Check for overlapping nodes (after vertical positioning)
  const overlaps = findOverlappingNodes(workflow.nodes);
  if (overlaps.length > 0 && autofix) {
    // Auto-fix: shift overlapping nodes apart (fallback for non-router cases)
    for (const { node1, node2 } of overlaps) {
      const n1 = workflow.nodes.find(n => n.name === node1);
      const n2 = workflow.nodes.find(n => n.name === node2);
      if (n1 && n2 && n1.position && n2.position) {
        // Shift node2 right by node width + spacing
        n2.position[0] = n1.position[0] + NODE_DIMENSIONS.width + MIN_SPACING.x;
        fixes.push(`Shifted node '${node2}' to avoid overlap with '${node1}'`);
      }
    }
  } else if (overlaps.length > 0) {
    for (const { node1, node2, pos } of overlaps) {
      errors.push(`Nodes '${node1}' and '${node2}' overlap at position [${pos[0]}, ${pos[1]}]`);
    }
  }

  // 4B: Check hierarchical positioning (sub-nodes below parents)
  if (workflow.connections) {
    const hierarchyIssues = checkHierarchicalPositioning(workflow);
    if (hierarchyIssues.length > 0) {
      for (const issue of hierarchyIssues) {
        warnings.push(issue);
      }
    }
  }

  // 4C: Check canvas bounds
  for (const node of workflow.nodes) {
    if (node.position) {
      const [x, y] = node.position;
      if (x < CANVAS_BOUNDS.min[0] || x > CANVAS_BOUNDS.max[0] ||
          y < CANVAS_BOUNDS.min[1] || y > CANVAS_BOUNDS.max[1]) {
        warnings.push(
          `Node '${node.name}' positioned outside recommended canvas area: [${x}, ${y}]`
        );
      }
    }
  }

  // 4D: Check for orphaned nodes (no inputs AND no outputs, except triggers/terminals)
  if (workflow.connections) {
    const orphaned = findOrphanedNodes(workflow);
    if (orphaned.length > 0) {
      for (const nodeName of orphaned) {
        warnings.push(`Node '${nodeName}' appears to be orphaned (no connections in or out)`);
      }
    }
  }

  return {
    passed: errors.length === 0,
    errors,
    warnings,
    fixes
  };
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function cloneWorkflow(workflow: Workflow): Workflow {
  return JSON.parse(JSON.stringify(workflow));
}

interface OverlapResult {
  node1: string;
  node2: string;
  pos: [number, number];
}

function findOverlappingNodes(nodes: Node[]): OverlapResult[] {
  const overlaps: OverlapResult[] = [];

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const n1 = nodes[i];
      const n2 = nodes[j];

      if (!n1.position || !n2.position) continue;

      // Check if bounding boxes intersect
      const [x1, y1] = n1.position;
      const [x2, y2] = n2.position;

      const box1 = {
        left: x1 - MIN_SPACING.x / 2,
        right: x1 + NODE_DIMENSIONS.width + MIN_SPACING.x / 2,
        top: y1 - MIN_SPACING.y / 2,
        bottom: y1 + NODE_DIMENSIONS.height + MIN_SPACING.y / 2
      };

      const box2 = {
        left: x2 - MIN_SPACING.x / 2,
        right: x2 + NODE_DIMENSIONS.width + MIN_SPACING.x / 2,
        top: y2 - MIN_SPACING.y / 2,
        bottom: y2 + NODE_DIMENSIONS.height + MIN_SPACING.y / 2
      };

      if (!(box1.right < box2.left || box1.left > box2.right ||
            box1.bottom < box2.top || box1.top > box2.bottom)) {
        overlaps.push({
          node1: n1.name,
          node2: n2.name,
          pos: n1.position
        });
      }
    }
  }

  return overlaps;
}

function checkHierarchicalPositioning(workflow: Workflow): string[] {
  const issues: string[] = [];
  const nodeMap = new Map(workflow.nodes.map(n => [n.name, n]));

  if (!workflow.connections) return issues;

  // For each connection, check if AI sub-nodes are positioned below parents
  for (const [parentName, outputMap] of Object.entries(workflow.connections)) {
    const parent = nodeMap.get(parentName);
    if (!parent || !parent.position) continue;

    for (const [portType, connectionArrays] of Object.entries(outputMap)) {
      // Only check AI ports (sub-nodes)
      if (!isAIPort(portType)) continue;

      for (const connArray of connectionArrays) {
        for (const conn of connArray) {
          const child = nodeMap.get(conn.node);
          if (!child || !child.position) continue;

          // Child should be positioned BELOW parent (higher Y value)
          if (child.position[1] <= parent.position[1]) {
            issues.push(
              `Sub-node '${child.name}' should be positioned BELOW parent '${parentName}' ` +
              `(child.y=${child.position[1]} should be > parent.y=${parent.position[1]})`
            );
          }
        }
      }
    }
  }

  return issues;
}

function findOrphanedNodes(workflow: Workflow): string[] {
  const orphaned: string[] = [];
  const connected = new Set<string>();

  if (!workflow.connections) return orphaned;

  // Mark all nodes that have connections
  for (const [sourceName, outputMap] of Object.entries(workflow.connections)) {
    connected.add(sourceName);

    for (const [_, connectionArrays] of Object.entries(outputMap)) {
      for (const connArray of connectionArrays) {
        for (const conn of connArray) {
          connected.add(conn.node);
        }
      }
    }
  }

  // Find nodes with no connections
  for (const node of workflow.nodes) {
    if (connected.has(node.name)) continue;

    // Ignore triggers (they don't need inputs)
    if (isStartingNode(node.type)) continue;

    // Ignore sticky notes
    if (node.type === 'n8n-nodes-base.stickyNote') continue;

    orphaned.push(node.name);
  }

  return orphaned;
}
