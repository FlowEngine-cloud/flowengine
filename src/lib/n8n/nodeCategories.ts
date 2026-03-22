// ⚠️ AUTO-GENERATED — DO NOT EDIT
// Generated: 2025-10-09T17:39:41.840Z
// Source: tools/create-node-categories.ts

/**
 * Node Categories - Purpose-driven classification
 * 
 * Categories organize nodes by their PURPOSE, not implementation details.
 * This makes it easy for AI to find the right node for a task.
 * 
 * TOOL HIERARCHY (based on sub-node requirements):
 * 
 * 1. Simple Tools (no sub-nodes):
 *    - toolCode, toolCalculator, toolHttpRequest, toolWorkflow
 *    - Connect directly to agents via ai_tool
 * 
 * 2. Tools with Sub-Nodes:
 *    
 *    a) toolVectorStore:
 *       toolVectorStore (TOOL)
 *       ├─ ChatModel (optional, ai_languageModel)
 *       └─ VectorStore (required, ai_vectorStore)
 *          └─ Embeddings (required, ai_embedding)
 *    
 *    b) agentTool:
 *       agentTool (TOOL)
 *       └─ Agent (required, ai_agent)
 *          ├─ ChatModel (required, ai_languageModel)
 *          └─ Memory (required, ai_memory)
 * 
 * 3. Vector Stores as Tools:
 *    - vectorStoreZep, vectorStorePinecone, etc.
 *    - When mode="retrieve-as-tool", they connect as ai_tool directly
 *    - Otherwise, they're sub-nodes for toolVectorStore
 */

import { ALL_NODES } from './nodeCategories.generated';

export enum NodeCategory {
  /** Workflow triggers - Start execution */
  TRIGGER = 'trigger',
  
  /** Regular service actions - API integrations, data manipulation */
  ACTION = 'action',
  
  /** AI Agent tools - All tools that connect to agents (~300 total) */
  TOOL = 'tool',
  
  /** AI Agents - The main conversational agent node */
  AI_AGENT = 'ai_agent',
  
  /** AI Chat Models - Language models (OpenAI, Anthropic, Gemini, etc.) */
  AI_CHAT_MODEL = 'ai_chat_model',
  
  /** AI Memory - Conversation context storage */
  AI_MEMORY = 'ai_memory',
  
  /** Vector Stores - Semantic search databases */
  VECTOR_STORE = 'vector_store',
  
  /** Embeddings - Text-to-vector conversion models */
  EMBEDDINGS = 'embeddings',
  
  /** Flow Control - Conditional logic, routing, loops */
  FLOW_CONTROL = 'flow_control',
}

/**
 * Sub-node requirement - What a node needs to function
 */
export interface SubNodeRequirement {
  /** Category of the required sub-node */
  category: NodeCategory;
  
  /** Connection type (e.g., 'ai_tool', 'ai_languageModel') */
  connection: string;
  
  /** Is this sub-node required or optional? */
  required: boolean;
  
  /** Human-readable description */
  description: string;
}

/**
 * Node pattern metadata - How to implement a node
 */
export interface NodePattern {
  /** Category of this node */
  category: NodeCategory;
  
  /** Does this node require sub-nodes? */
  requiresSubNodes: boolean;
  
  /** What sub-nodes are needed (if any) */
  subNodePatterns?: SubNodeRequirement[];
  
  /** Valid connection types for this node */
  connectionTypes: string[];
  
  /** Example node types in this category */
  exampleTypes: string[];
  
  /** Description of this category */
  description: string;
}

/**
 * Complete pattern database - Metadata for all node categories
 */
export const NODE_PATTERNS: Record<NodeCategory, NodePattern> = {
  [NodeCategory.TRIGGER]: {
    category: NodeCategory.TRIGGER,
    requiresSubNodes: false,
    connectionTypes: ['main'],
    exampleTypes: [
      'n8n-nodes-base.webhook',
      'n8n-nodes-base.manualTrigger',
      '@n8n/n8n-nodes-langchain.manualChatTrigger'
    ],
    description: 'Workflow trigger - starts workflow execution'
  },
  
  [NodeCategory.ACTION]: {
    category: NodeCategory.ACTION,
    requiresSubNodes: false,
    connectionTypes: ['main'],
    exampleTypes: [
      'n8n-nodes-base.httpRequest',
      'n8n-nodes-base.twilio',
      'n8n-nodes-base.slack',
      'n8n-nodes-base.set'
    ],
    description: 'Regular service action - no sub-nodes needed'
  },
  
  [NodeCategory.TOOL]: {
    category: NodeCategory.TOOL,
    requiresSubNodes: false, // Default - but toolVectorStore and agentTool need sub-nodes
    connectionTypes: ['ai_tool'],
    exampleTypes: [
      // Simple tools (no sub-nodes)
      '@n8n/n8n-nodes-langchain.toolCode',
      '@n8n/n8n-nodes-langchain.toolCalculator',
      '@n8n/n8n-nodes-langchain.toolHttpRequest',
      '@n8n/n8n-nodes-langchain.toolWorkflow',
      // Complex tools (need sub-nodes)
      '@n8n/n8n-nodes-langchain.toolVectorStore', // Needs: VectorStore → Embeddings, optional ChatModel
      '@n8n/n8n-nodes-langchain.agentTool', // Needs: Agent → Model + Memory
      // Vector stores in retrieve mode
      '@n8n/n8n-nodes-langchain.vectorStoreZep' // When mode="retrieve-as-tool"
    ],
    description: 'AI Agent Tools - ALL tools connect via ai_tool. Some are simple, some need sub-nodes.'
  },
  
  [NodeCategory.AI_AGENT]: {
    category: NodeCategory.AI_AGENT,
    requiresSubNodes: true,
    subNodePatterns: [
      {
        category: NodeCategory.AI_CHAT_MODEL,
        connection: 'ai_languageModel',
        required: true,
        description: 'Every AI Agent needs exactly 1 Chat Model'
      },
      {
        category: NodeCategory.AI_MEMORY,
        connection: 'ai_memory',
        required: true,
        description: 'Every AI Agent needs exactly 1 Memory'
      },
      {
        category: NodeCategory.TOOL,
        connection: 'ai_tool',
        required: false,
        description: 'AI Agents can have 0 or more Tools'
      }
    ],
    connectionTypes: ['main', 'ai_languageModel', 'ai_memory', 'ai_tool'],
    exampleTypes: ['@n8n/n8n-nodes-langchain.agent'],
    description: 'AI Agent - requires Model + Memory, optional Tools'
  },
  
  [NodeCategory.AI_CHAT_MODEL]: {
    category: NodeCategory.AI_CHAT_MODEL,
    requiresSubNodes: false,
    connectionTypes: ['ai_languageModel'],
    exampleTypes: [
      '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      '@n8n/n8n-nodes-langchain.lmChatAnthropic',
      '@n8n/n8n-nodes-langchain.lmChatGoogleGemini'
    ],
    description: 'AI Chat Model - provides language model capability'
  },
  
  [NodeCategory.AI_MEMORY]: {
    category: NodeCategory.AI_MEMORY,
    requiresSubNodes: false,
    connectionTypes: ['ai_memory'],
    exampleTypes: [
      '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      '@n8n/n8n-nodes-langchain.memoryChat'
    ],
    description: 'AI Memory - stores conversation context'
  },
  
  [NodeCategory.VECTOR_STORE]: {
    category: NodeCategory.VECTOR_STORE,
    requiresSubNodes: true,
    subNodePatterns: [
      {
        category: NodeCategory.EMBEDDINGS,
        connection: 'ai_embedding',
        required: true,
        description: 'Vector Store needs an Embeddings Model'
      }
    ],
    connectionTypes: ['ai_vectorStore', 'ai_embedding'],
    exampleTypes: [
      '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
      '@n8n/n8n-nodes-langchain.vectorStorePinecone',
      '@n8n/n8n-nodes-langchain.vectorStoreZep' // Can also be used as TOOL in retrieve mode
    ],
    description: 'Vector Store - sub-node for toolVectorStore. Always needs Embeddings. Can also be used as a tool directly in "retrieve-as-tool" mode.'
  },
  
  [NodeCategory.EMBEDDINGS]: {
    category: NodeCategory.EMBEDDINGS,
    requiresSubNodes: false,
    connectionTypes: ['ai_embedding'],
    exampleTypes: [
      '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
      '@n8n/n8n-nodes-langchain.embeddingsCohere'
    ],
    description: 'Embeddings Model - converts text to vectors'
  },
  
  [NodeCategory.FLOW_CONTROL]: {
    category: NodeCategory.FLOW_CONTROL,
    requiresSubNodes: false,
    connectionTypes: ['main'],
    exampleTypes: [
      'n8n-nodes-base.if',
      'n8n-nodes-base.switch',
      'n8n-nodes-base.merge'
    ],
    description: 'Flow Control - conditional logic and routing'
  }
};

/**
 * Get node category from node type
 */
export function categorizeNode(nodeType: string): NodeCategory {
  // AI Components (check these first - most specific)
  if (nodeType === '@n8n/n8n-nodes-langchain.agent') return NodeCategory.AI_AGENT;
  if (nodeType.includes('.lmChat')) return NodeCategory.AI_CHAT_MODEL;
  if (nodeType.includes('.memory')) return NodeCategory.AI_MEMORY;
  if (nodeType.includes('.embeddings')) return NodeCategory.EMBEDDINGS;
  if (nodeType.includes('.vectorStore') && !nodeType.includes('tool')) return NodeCategory.VECTOR_STORE;
  
  // Tools (check before other categories)
  if (nodeType.includes('.tool') || nodeType.includes('Tool')) return NodeCategory.TOOL;
  
  // Triggers
  if (nodeType.includes('Trigger') || nodeType === 'n8n-nodes-base.webhook' || nodeType === 'n8n-nodes-base.manualTrigger') {
    return NodeCategory.TRIGGER;
  }
  
  // Flow Control
  if (nodeType.match(/\.(if|switch|merge|splitInBatches|loop|wait)$/)) return NodeCategory.FLOW_CONTROL;
  
  // Default: ACTION (service integrations, regular nodes)
  return NodeCategory.ACTION;
}

/**
 * Get required sub-nodes for a node type
 */
export function getRequiredSubNodes(nodeType: string): SubNodeRequirement[] {
  // Special cases with explicit sub-node requirements
  
  // AI Agent: needs Model + Memory
  if (nodeType === '@n8n/n8n-nodes-langchain.agent') {
    return [
      {
        category: NodeCategory.AI_CHAT_MODEL,
        connection: 'ai_languageModel',
        required: true,
        description: 'Every AI Agent needs exactly 1 Chat Model'
      },
      {
        category: NodeCategory.AI_MEMORY,
        connection: 'ai_memory',
        required: true,
        description: 'Every AI Agent needs exactly 1 Memory'
      }
    ];
  }
  
  // Vector Store Tool: needs Vector Store (which needs Embeddings)
  if (nodeType.includes('toolVectorStore')) {
    return [
      {
        category: NodeCategory.VECTOR_STORE,
        connection: 'ai_vectorStore',
        required: true,
        description: 'Vector Store Tool needs a Vector Store (which itself needs Embeddings)'
      }
    ];
  }
  
  // Agent Tool: needs full Agent
  if (nodeType.includes('agentTool')) {
    return [
      {
        category: NodeCategory.AI_AGENT,
        connection: 'ai_agent',
        required: true,
        description: 'Agent Tool wraps a complete Agent (which has its own Model + Memory + Tools)'
      }
    ];
  }
  
  // Vector Stores: need Embeddings
  if (nodeType.includes('vectorStore') && !nodeType.includes('tool')) {
    return [
      {
        category: NodeCategory.EMBEDDINGS,
        connection: 'ai_embedding',
        required: true,
        description: 'Vector Store needs an Embeddings Model'
      }
    ];
  }
  
  // Chains: need Language Model
  // IMPORTANT: Use .chain pattern, not just 'chain' - otherwise matches 'langchain' in all nodes!
  if (nodeType.includes('.chain')) {
    return [
      {
        category: NodeCategory.AI_CHAT_MODEL,
        connection: 'ai_languageModel',
        required: true,
        description: 'Chain needs a Language Model'
      }
    ];
  }

  // Retrievers: need Vector Store
  if (nodeType.includes('.retriever')) {
    return [
      {
        category: NodeCategory.VECTOR_STORE,
        connection: 'ai_vectorStore',
        required: true,
        description: 'Retriever needs a Vector Store (which needs Embeddings)'
      }
    ];
  }
  
  return [];
}

/**
 * Get all sub-nodes (required + optional) for a node type
 */
export function getAllSubNodes(nodeType: string): SubNodeRequirement[] {
  const category = categorizeNode(nodeType);
  return NODE_PATTERNS[category].subNodePatterns || [];
}

/**
 * Get node pattern metadata
 */
export function getNodePattern(nodeType: string): NodePattern {
  const category = categorizeNode(nodeType);
  return NODE_PATTERNS[category];
}

/**
 * Check if node type is valid (exists in registry)
 */
export function isValidNodeType(nodeType: string): boolean {
  return ALL_NODES.includes(nodeType);
}
