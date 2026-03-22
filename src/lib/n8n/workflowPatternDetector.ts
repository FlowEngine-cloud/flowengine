/**
 * Workflow Pattern Detection System
 * Analyzes workflow structure to determine the pattern type
 */

export enum WorkflowPattern {
  SINGLE_AGENT = 'single_agent',           // 1 AI agent
  MULTI_AGENT_SEQUENTIAL = 'sequential',   // Agent1 → Agent2 → Agent3
  MULTI_AGENT_HIERARCHICAL = 'hierarchical', // Supervisor + toolCode specialists
  REGULAR_WORKFLOW = 'regular',            // No AI agents
  MIXED = 'mixed'                          // Multiple patterns (rare)
}

export interface AgentInfo {
  nodeId: string;
  name: string;
  type: string;
  parameters: any;
  position?: [number, number];
  isToolAgent?: boolean;
}

export interface WorkflowContext {
  pattern: WorkflowPattern;
  agentCount: number;
  hasToolAgents: boolean;
  agents: AgentInfo[];
  trigger?: {
    nodeId: string;
    name: string;
    type: string;
  };
}

/**
 * Detects the workflow pattern from the workflow structure
 */
export function detectWorkflowPattern(workflow: any): WorkflowContext {
  const agents = findAllAgents(workflow);
  const toolAgents = findToolAgents(workflow);
  const trigger = findTriggerNode(workflow);

  // No AI agents - regular workflow
  if (agents.length === 0) {
    return {
      pattern: WorkflowPattern.REGULAR_WORKFLOW,
      agentCount: 0,
      hasToolAgents: false,
      agents: [],
      trigger
    };
  }

  // Single AI agent
  if (agents.length === 1) {
    return {
      pattern: WorkflowPattern.SINGLE_AGENT,
      agentCount: 1,
      hasToolAgents: false,
      agents,
      trigger
    };
  }

  // Multiple agents - check if hierarchical (has tool nodes acting as specialists)
  // Note: Hierarchical now uses toolCode nodes, not toolAgent
  // For now, assume multiple agents are sequential unless proven otherwise
  // (toolAgent detection removed since that node type doesn't exist)

  // Check if agents are chained sequentially
  if (areAgentsChained(workflow, agents)) {
    return {
      pattern: WorkflowPattern.MULTI_AGENT_SEQUENTIAL,
      agentCount: agents.length,
      hasToolAgents: false,
      agents,
      trigger
    };
  }

  // Default to mixed if we can't determine
  return {
    pattern: WorkflowPattern.MIXED,
    agentCount: agents.length,
    hasToolAgents: toolAgents.length > 0,
    agents,
    trigger
  };
}

/**
 * Find all AI Agent nodes in the workflow
 */
function findAllAgents(workflow: any): AgentInfo[] {
  const nodes = workflow?.nodes || [];
  const agents: AgentInfo[] = [];

  for (const node of nodes) {
    if (isAIAgentNode(node)) {
      agents.push({
        nodeId: node.id || node.name,
        name: node.name,
        type: node.type,
        parameters: node.parameters || {},
        position: node.position,
        isToolAgent: node.parameters?.options?.systemMessage?.includes('toolAgent') || false
      });
    }
  }

  return agents;
}

/**
 * Find all toolAgent nodes
 */
function findToolAgents(workflow: any): AgentInfo[] {
  const agents = findAllAgents(workflow);
  return agents.filter(agent => agent.isToolAgent);
}

/**
 * Find the trigger node
 */
function findTriggerNode(workflow: any): WorkflowContext['trigger'] | undefined {
  const nodes = workflow?.nodes || [];

  for (const node of nodes) {
    if (isTriggerNode(node)) {
      return {
        nodeId: node.id || node.name,
        name: node.name,
        type: node.type
      };
    }
  }

  return undefined;
}

/**
 * Check if agents are chained sequentially
 */
function areAgentsChained(workflow: any, agents: AgentInfo[]): boolean {
  if (agents.length < 2) return false;

  const connections = workflow?.connections || {};
  const agentIds = new Set(agents.map(a => a.nodeId));

  // Check if agents are connected in a chain
  // For each agent, check if it connects to another agent
  let chainCount = 0;

  for (const agent of agents) {
    const nodeConnections = connections[agent.nodeId];
    if (!nodeConnections) continue;

    // Check main output
    const mainOutput = nodeConnections['main'];
    if (!mainOutput || !mainOutput[0]) continue;

    // Check if any connection goes to another agent
    for (const conn of mainOutput[0]) {
      if (agentIds.has(conn.node)) {
        chainCount++;
        break;
      }
    }
  }

  // If most agents connect to other agents, it's sequential
  return chainCount >= agents.length - 1;
}

/**
 * Check if a node is an AI Agent
 */
function isAIAgentNode(node: any): boolean {
  return node?.type === '@n8n/n8n-nodes-langchain.agent';
}

/**
 * Check if a node is a trigger
 */
function isTriggerNode(node: any): boolean {
  const type = node?.type || '';
  return type.includes('Trigger') || type.includes('trigger');
}

/**
 * Get a human-readable description of the pattern
 */
export function getPatternDescription(pattern: WorkflowPattern): string {
  switch (pattern) {
    case WorkflowPattern.SINGLE_AGENT:
      return 'Single AI Agent workflow';
    case WorkflowPattern.MULTI_AGENT_SEQUENTIAL:
      return 'Sequential Multi-Agent workflow (Agent1 → Agent2 → Agent3)';
    case WorkflowPattern.MULTI_AGENT_HIERARCHICAL:
      return 'Hierarchical Multi-Agent workflow (Supervisor + Specialists)';
    case WorkflowPattern.REGULAR_WORKFLOW:
      return 'Regular n8n workflow (no AI agents)';
    case WorkflowPattern.MIXED:
      return 'Mixed pattern workflow';
    default:
      return 'Unknown pattern';
  }
}

/**
 * Get validation rules for a pattern
 */
export function getPatternRules(pattern: WorkflowPattern): {
  requiresModel: boolean;
  requiresMemory: boolean;
  allowsMultipleAgents: boolean;
  requiresToolAgents: boolean;
} {
  switch (pattern) {
    case WorkflowPattern.SINGLE_AGENT:
      return {
        requiresModel: true,
        requiresMemory: true,
        allowsMultipleAgents: false,
        requiresToolAgents: false
      };

    case WorkflowPattern.MULTI_AGENT_SEQUENTIAL:
      return {
        requiresModel: true,  // Each agent needs its own model
        requiresMemory: true, // Each agent needs its own memory
        allowsMultipleAgents: true,
        requiresToolAgents: false
      };

    case WorkflowPattern.MULTI_AGENT_HIERARCHICAL:
      return {
        requiresModel: true,
        requiresMemory: true,
        allowsMultipleAgents: true,
        requiresToolAgents: false  // No longer requires toolAgent (uses toolCode)
      };

    default:
      return {
        requiresModel: false,
        requiresMemory: false,
        allowsMultipleAgents: true,
        requiresToolAgents: false
      };
  }
}
