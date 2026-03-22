/**
 * Multi-Agent Workflow Orchestrator
 *
 * Creates validated multi-agent workflows with three primary patterns:
 * 1. Sequential Pipeline - Agent1 → Agent2 → Agent3 (linear processing)
 * 2. Hierarchical/Supervisor - Coordinator delegates to specialists
 * 3. Parallel Processing - Multiple agents work simultaneously
 *
 * All patterns use FULL AI agents (not toolAgent sub-agents) for:
 * - Better flexibility and debugging
 * - Consistent structure
 * - Easier validation
 */

import { v4 as uuidv4 } from 'uuid';
import type { GeneratedWorkflow, WorkflowNode, WorkflowConnections } from '../workflowGenerator';

export type MultiAgentPattern = 'sequential' | 'hierarchical' | 'parallel';

export interface AgentDefinition {
  name: string;
  role: 'coordinator' | 'specialist' | 'processor';
  systemMessage: string;
  model?: 'flowengine' | 'openai' | 'anthropic' | 'gemini' | 'groq' | 'ollama';
  tools: string[]; // 'code', 'http', 'calculator', 'wikipedia', etc.
  delegatesTo?: string[]; // For hierarchical pattern only
  includeMemory?: boolean; // If true, include memory node (default: true for multi-agent)
}

export interface MultiAgentWorkflowConfig {
  name: string;
  description: string;
  pattern: MultiAgentPattern;
  agents: AgentDefinition[];
  trigger?: 'manual_chat' | 'webhook' | 'schedule';
}

/**
 * Node position constants for consistent layout
 * Each agent occupies a vertical column with 800px horizontal spacing
 */
const LAYOUT = {
  // Horizontal spacing between agents
  AGENT_HORIZONTAL_SPACING: 800,

  // Vertical positions relative to agent (Y=300)
  MEMORY_Y: 50,      // Top
  MODEL_Y: 100,      // Above agent
  AGENT_Y: 300,      // Center (main flow)
  TOOL_BASE_Y: 400,  // Below agent
  TOOL_SPACING: 150, // Between tools

  // Starting positions
  START_X: 200,
  TRIGGER_X: 100,
  TRIGGER_Y: 300,
} as const;

/**
 * Modern node types (from nodeTypeMapping)
 */
const NODE_TYPES = {
  CHAT_TRIGGER: '@n8n/n8n-nodes-langchain.chatTrigger',
  AI_AGENT: '@n8n/n8n-nodes-langchain.agent',
  // ⭐ FLOWENGINE LLM - PREFERRED DEFAULT (pre-configured, no API key needed)
  FLOWENGINE_LLM: 'CUSTOM.flowEngineLlm',
  OPENAI_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  ANTHROPIC_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  GEMINI_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  GROQ_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatGroq',
  OLLAMA_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatOllama',
  MEMORY_BUFFER_WINDOW: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  CODE_TOOL: '@n8n/n8n-nodes-langchain.toolCode',
  HTTP_TOOL: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  CALCULATOR_TOOL: '@n8n/n8n-nodes-langchain.toolCalculator',
  WIKIPEDIA_TOOL: '@n8n/n8n-nodes-langchain.toolWikipedia',
  WORKFLOW_TOOL: '@n8n/n8n-nodes-langchain.toolWorkflow',
  SERP_API_TOOL: '@n8n/n8n-nodes-langchain.toolSerpApi',
  // AGENT_TOOL removed - toolAgent node type does not exist
} as const;

/**
 * Create a complete multi-agent workflow
 */
export function createMultiAgentWorkflow(config: MultiAgentWorkflowConfig): GeneratedWorkflow {
  const nodes: WorkflowNode[] = [];
  const connections: WorkflowConnections = {};

  // 1. Create trigger
  const trigger = createChatTrigger();
  nodes.push(trigger);

  // 2. Create agents based on pattern
  switch (config.pattern) {
    case 'sequential':
      createSequentialPattern(config, nodes, connections, trigger);
      break;
    case 'hierarchical':
      createHierarchicalPattern(config, nodes, connections, trigger);
      break;
    case 'parallel':
      createParallelPattern(config, nodes, connections, trigger);
      break;
  }

  return {
    id: uuidv4(),
    name: config.name,
    nodes,
    connections,
    meta: { instanceId: uuidv4() },
    active: true,
    settings: {},
  };
}

/**
 * Sequential Pattern: Agent1 → Agent2 → Agent3
 * Each agent processes output from the previous one
 */
function createSequentialPattern(
  config: MultiAgentWorkflowConfig,
  nodes: WorkflowNode[],
  connections: WorkflowConnections,
  trigger: WorkflowNode
): void {
  let previousAgent: WorkflowNode | null = null;

  config.agents.forEach((agentDef, index) => {
    const agentX = LAYOUT.START_X + (index * LAYOUT.AGENT_HORIZONTAL_SPACING);

    // Create agent with all support nodes
    const { agent, model, memory, tools } = createAgentCluster(agentDef, agentX);

    nodes.push(agent, model, ...tools);
    if (memory) nodes.push(memory);

    // Connect support nodes to agent
    connectSupportNodes(connections, model, memory, tools, agent);

    // Connect to workflow flow
    if (index === 0) {
      // First agent connects from trigger
      connections[trigger.name] = {
        main: [[{ node: agent.name, type: 'main', index: 0 }]],
      };
    } else if (previousAgent) {
      // Subsequent agents connect from previous agent
      connections[previousAgent.name] = {
        main: [[{ node: agent.name, type: 'main', index: 0 }]],
      };
    }

    previousAgent = agent;
  });
}

/**
 * Hierarchical Pattern: Coordinator → [Specialist1, Specialist2, ...]
 * Coordinator uses Agent Tools to delegate to specialists
 */
function createHierarchicalPattern(
  config: MultiAgentWorkflowConfig,
  nodes: WorkflowNode[],
  connections: WorkflowConnections,
  trigger: WorkflowNode
): void {
  // Find coordinator
  const coordinatorDef = config.agents.find(a => a.role === 'coordinator');
  const specialistDefs = config.agents.filter(a => a.role === 'specialist');

  if (!coordinatorDef) {
    throw new Error('Hierarchical pattern requires a coordinator agent');
  }

  // 1. Create coordinator at center-left
  const coordinatorX = LAYOUT.START_X;
  const { agent: coordinator, model: coordModel, memory: coordMemory, tools: coordTools } =
    createAgentCluster(coordinatorDef, coordinatorX);

  nodes.push(coordinator, coordModel, ...coordTools);
  if (coordMemory) nodes.push(coordMemory);
  connectSupportNodes(connections, coordModel, coordMemory, coordTools, coordinator);

  // Connect trigger to coordinator
  connections[trigger.name] = {
    main: [[{ node: coordinator.name, type: 'main', index: 0 }]],
  };

  // 2. Create Code Tool nodes for each specialist (these connect to coordinator)
  // Note: Using CODE_TOOL instead of AGENT_TOOL (which doesn't exist)
  const agentTools: WorkflowNode[] = [];

  specialistDefs.forEach((specialistDef, index) => {
    const agentTool = createNode(NODE_TYPES.CODE_TOOL, {
      name: `${specialistDef.name} (Tool)`,
      position: [coordinatorX, LAYOUT.TOOL_BASE_Y + (index * LAYOUT.TOOL_SPACING)],
      parameters: {
        name: specialistDef.name,
        description: specialistDef.systemMessage,
        language: 'javascript',
      },
    });

    agentTools.push(agentTool);
    nodes.push(agentTool);

    // Connect Agent Tool to coordinator
    if (!connections[agentTool.name]) {
      connections[agentTool.name] = {};
    }
    connections[agentTool.name].ai_tool = [[{
      node: coordinator.name,
      type: 'ai_tool',
      index: coordTools.length + index,
    }]];
  });

  // 3. Create actual specialist agents (to the right)
  specialistDefs.forEach((specialistDef, index) => {
    const specialistX = LAYOUT.START_X + ((index + 1) * LAYOUT.AGENT_HORIZONTAL_SPACING);
    const specialistY = LAYOUT.AGENT_Y + (index * 500); // Stagger vertically

    const { agent: specialist, model: specModel, memory: specMemory, tools: specTools } =
      createAgentCluster(specialistDef, specialistX, specialistY);

    nodes.push(specialist, specModel, ...specTools);
    if (specMemory) nodes.push(specMemory);
    connectSupportNodes(connections, specModel, specMemory, specTools, specialist);

    // Connect Agent Tool to specialist via ai_agent connection
    const agentTool = agentTools[index];
    if (!connections[agentTool.name].ai_agent) {
      connections[agentTool.name].ai_agent = [];
    }
    connections[agentTool.name].ai_agent.push([{
      node: specialist.name,
      type: 'main',
      index: 0,
    }]);
  });
}

/**
 * Parallel Pattern: Multiple agents process simultaneously → Aggregator
 * All agents receive same input, results are merged
 */
function createParallelPattern(
  config: MultiAgentWorkflowConfig,
  nodes: WorkflowNode[],
  connections: WorkflowConnections,
  trigger: WorkflowNode
): void {
  const parallelAgents: WorkflowNode[] = [];

  // Create all agents in parallel
  config.agents.forEach((agentDef, index) => {
    const agentX = LAYOUT.START_X + (index * LAYOUT.AGENT_HORIZONTAL_SPACING);

    const { agent, model, memory, tools } = createAgentCluster(agentDef, agentX);

    nodes.push(agent, model, ...tools);
    if (memory) nodes.push(memory);
    connectSupportNodes(connections, model, memory, tools, agent);

    // All agents connect from trigger (parallel execution)
    if (!connections[trigger.name]) {
      connections[trigger.name] = { main: [[]] };
    }
    connections[trigger.name].main[0].push({
      node: agent.name,
      type: 'main',
      index: index,
    });

    parallelAgents.push(agent);
  });

  // Create aggregator (merge node) if more than one agent
  if (parallelAgents.length > 1) {
    const aggregator = createNode('n8n-nodes-base.merge', {
      name: 'Merge Results',
      position: [
        LAYOUT.START_X + (config.agents.length * LAYOUT.AGENT_HORIZONTAL_SPACING),
        LAYOUT.AGENT_Y
      ],
      parameters: { mode: 'append' },
    });

    nodes.push(aggregator);

    // Connect all agents to aggregator
    parallelAgents.forEach((agent, index) => {
      if (!connections[agent.name]) {
        connections[agent.name] = {};
      }
      connections[agent.name].main = [[{
        node: aggregator.name,
        type: 'main',
        index: 0,
      }]];
    });
  }
}

/**
 * Create an agent cluster (agent + model + memory + tools) at specified position
 */
function createAgentCluster(
  agentDef: AgentDefinition,
  agentX: number,
  agentY: number = LAYOUT.AGENT_Y
): {
  agent: WorkflowNode;
  model: WorkflowNode;
  memory: WorkflowNode | null;  // Memory is optional
  tools: WorkflowNode[];
} {
  // Create AI Agent
  const agent = createNode(NODE_TYPES.AI_AGENT, {
    name: agentDef.name,
    position: [agentX, agentY],
    parameters: {
      agent: 'conversationalAgent',
      promptType: 'auto',
      systemMessage: agentDef.systemMessage,
    },
    typeVersion: 3.1, // Required for n8n v2.x
  });

  // Create Chat Model (default to FlowEngine LLM - pre-configured, no API key needed)
  const modelType = getModelNodeType(agentDef.model || 'flowengine');
  const model = createNode(modelType, {
    name: `${agentDef.name} Model`,
    position: [agentX, LAYOUT.MODEL_Y],
    parameters: getModelParameters(agentDef.model || 'flowengine'),
    typeVersion: modelType === NODE_TYPES.FLOWENGINE_LLM ? 1 : 1.2,
  });

  // Create Memory (optional - defaults to true for multi-agent workflows)
  let memory: WorkflowNode | null = null;
  if (agentDef.includeMemory !== false) {
    memory = createNode(NODE_TYPES.MEMORY_BUFFER_WINDOW, {
      name: `${agentDef.name} Memory`,
      position: [agentX, LAYOUT.MEMORY_Y],
      parameters: {
        sessionIdOption: 'fromInput',
        contextWindowLength: 10,
      },
      typeVersion: 1.3, // Required for n8n v2.x
    });
  }

  // Create Tools
  const tools: WorkflowNode[] = agentDef.tools.map((toolType, index) => {
    const toolNodeType = getToolNodeType(toolType);
    return createNode(toolNodeType, {
      name: `${agentDef.name} ${capitalize(toolType)} Tool`,
      position: [agentX + (index * 150), LAYOUT.TOOL_BASE_Y],
      parameters: getToolParameters(toolType),
    });
  });

  return { agent, model, memory, tools };
}

/**
 * Connect support nodes (model, memory, tools) to agent
 */
function connectSupportNodes(
  connections: WorkflowConnections,
  model: WorkflowNode,
  memory: WorkflowNode | null,  // Memory is optional
  tools: WorkflowNode[],
  agent: WorkflowNode
): void {
  // Connect model to agent
  connections[model.name] = {
    ai_languageModel: [[{
      node: agent.name,
      type: 'ai_languageModel',
      index: 0,
    }]],
  };

  // Connect memory to agent (only if memory exists)
  if (memory) {
    connections[memory.name] = {
      ai_memory: [[{
        node: agent.name,
        type: 'ai_memory',
        index: 0,
      }]],
    };
  }

  // Connect tools to agent
  tools.forEach((tool, index) => {
    connections[tool.name] = {
      ai_tool: [[{
        node: agent.name,
        type: 'ai_tool',
        index: index,
      }]],
    };
  });
}

/**
 * Create chat trigger node
 */
function createChatTrigger(): WorkflowNode {
  return createNode(NODE_TYPES.CHAT_TRIGGER, {
    name: 'When chat message received',
    position: [LAYOUT.TRIGGER_X, LAYOUT.TRIGGER_Y],
    parameters: { public: true, options: {} },
    typeVersion: 1.4,
  });
}

/**
 * Generic node creator
 */
function createNode(
  type: string,
  options: {
    name: string;
    position: [number, number];
    parameters: Record<string, any>;
    typeVersion?: number;
  }
): WorkflowNode {
  // n8n expected property order: parameters, id, name, type, position, typeVersion
  return {
    parameters: options.parameters,
    id: uuidv4(),
    name: options.name,
    type,
    position: options.position,
    typeVersion: options.typeVersion ?? 1,
  };
}

/**
 * Get model node type based on provider
 * Default to FlowEngine LLM (pre-configured, no API key needed)
 */
function getModelNodeType(provider: string): string {
  switch (provider) {
    case 'flowengine':
      return NODE_TYPES.FLOWENGINE_LLM;
    case 'openai':
      return NODE_TYPES.OPENAI_CHAT_MODEL;
    case 'anthropic':
      return NODE_TYPES.ANTHROPIC_CHAT_MODEL;
    case 'gemini':
      return NODE_TYPES.GEMINI_CHAT_MODEL;
    case 'groq':
      return NODE_TYPES.GROQ_CHAT_MODEL;
    case 'ollama':
      return NODE_TYPES.OLLAMA_CHAT_MODEL;
    default:
      return NODE_TYPES.FLOWENGINE_LLM;
  }
}

/**
 * Get model parameters based on provider
 */
function getModelParameters(provider: string): Record<string, any> {
  // User configures model in n8n UI - do not hardcode
  return { options: {} };
}

/**
 * Get tool node type
 */
function getToolNodeType(toolType: string): string {
  switch (toolType.toLowerCase()) {
    case 'code':
      return NODE_TYPES.CODE_TOOL;
    case 'http':
      return NODE_TYPES.HTTP_TOOL;
    case 'calculator':
      return NODE_TYPES.CALCULATOR_TOOL;
    case 'wikipedia':
      return NODE_TYPES.WIKIPEDIA_TOOL;
    case 'workflow':
      return NODE_TYPES.WORKFLOW_TOOL;
    case 'serpapi':
      return NODE_TYPES.SERP_API_TOOL;
    default:
      return NODE_TYPES.CODE_TOOL;
  }
}

/**
 * Get tool parameters
 */
function getToolParameters(toolType: string): Record<string, any> {
  switch (toolType.toLowerCase()) {
    case 'code':
      return { language: 'javascript' };
    default:
      return {};
  }
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
