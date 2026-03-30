/**
 * Port Capabilities - Node Type → Port Type Mappings
 *
 * Defines which port types each node type can OUTPUT and accept as INPUT.
 * This is the source of truth for validating connections between nodes.
 */

export interface PortCapabilities {
  /** Port types this node can output on */
  outputs: string[];
  /** Port types this node can accept as input */
  inputs: string[];
}

/**
 * Comprehensive mapping of node types to their port capabilities
 * Based on n8n's actual node implementations and LangChain integrations
 */
export const PORT_CAPABILITIES: Record<string, PortCapabilities> = {
  // ========================================
  // AI LANGUAGE MODELS
  // ========================================
  // FlowEngine's LLM Chat Model (default, no API key needed)
  'CUSTOM.flowEngineLlm': {
    outputs: ['ai_languageModel'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.lmChatOpenAi': {
    outputs: ['ai_languageModel'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.lmChatAnthropic': {
    outputs: ['ai_languageModel'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.lmChatAzureOpenAi': {
    outputs: ['ai_languageModel'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.lmChatGoogleGemini': {
    outputs: ['ai_languageModel'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.lmChatGoogleVertex': {
    outputs: ['ai_languageModel'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.lmChatOllama': {
    outputs: ['ai_languageModel'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.lmChatMistralCloud': {
    outputs: ['ai_languageModel'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.lmChatGroq': {
    outputs: ['ai_languageModel'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.lmChatAws': {
    outputs: ['ai_languageModel'],
    inputs: []
  },

  // ========================================
  // AI AGENTS
  // ========================================
  '@n8n/n8n-nodes-langchain.agent': {
    outputs: ['main'],
    inputs: ['ai_languageModel', 'ai_memory', 'ai_tool']
  },

  // ========================================
  // AI CHAINS
  // ========================================
  '@n8n/n8n-nodes-langchain.chainLlm': {
    outputs: ['main'],
    inputs: ['ai_languageModel']
  },
  '@n8n/n8n-nodes-langchain.chainSummarization': {
    outputs: ['main'],
    inputs: ['ai_languageModel']
  },

  // ========================================
  // AI MEMORY
  // ========================================
  '@n8n/n8n-nodes-langchain.memoryBufferWindow': {
    outputs: ['ai_memory'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.memoryChat': {
    outputs: ['ai_memory'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.memoryChatMessage': {
    outputs: ['ai_memory'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.memoryPostgres': {
    outputs: ['ai_memory'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.memoryRedis': {
    outputs: ['ai_memory'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.memoryXata': {
    outputs: ['ai_memory'],
    inputs: []
  },

  // ========================================
  // AI TOOLS
  // ========================================
  '@n8n/n8n-nodes-langchain.toolCalculator': {
    outputs: ['ai_tool'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.toolCode': {
    outputs: ['ai_tool'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.toolHttpRequest': {
    outputs: ['ai_tool'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.toolWorkflow': {
    outputs: ['ai_tool'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.toolVectorStore': {
    outputs: ['ai_tool'],
    inputs: ['ai_vectorStore', 'ai_languageModel'] // LLM is optional
  },
  '@n8n/n8n-nodes-langchain.agentTool': {
    outputs: ['ai_tool'],
    inputs: ['ai_agent']
  },
  '@n8n/n8n-nodes-langchain.mcpClientTool': {
    outputs: ['ai_tool'],
    inputs: []
  },

  // ========================================
  // EMBEDDINGS
  // ========================================
  '@n8n/n8n-nodes-langchain.embeddingsOpenAi': {
    outputs: ['ai_embedding'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.embeddingsAzureOpenAi': {
    outputs: ['ai_embedding'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.embeddingsCohere': {
    outputs: ['ai_embedding'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.embeddingsGoogleGemini': {
    outputs: ['ai_embedding'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.embeddingsGoogleVertex': {
    outputs: ['ai_embedding'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.embeddingsHuggingFaceInference': {
    outputs: ['ai_embedding'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.embeddingsMistralCloud': {
    outputs: ['ai_embedding'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.embeddingsOllama': {
    outputs: ['ai_embedding'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.embeddingsAws': {
    outputs: ['ai_embedding'],
    inputs: []
  },

  // ========================================
  // VECTOR STORES
  // ========================================
  // Note: Vector stores can output both ai_vectorStore (for toolVectorStore)
  // AND ai_tool (when mode='retrieve-as-tool')
  '@n8n/n8n-nodes-langchain.vectorStoreSupabase': {
    outputs: ['ai_vectorStore', 'ai_tool'],
    inputs: ['ai_embedding', 'ai_document']
  },
  '@n8n/n8n-nodes-langchain.vectorStorePinecone': {
    outputs: ['ai_vectorStore', 'ai_tool'],
    inputs: ['ai_embedding', 'ai_document']
  },
  '@n8n/n8n-nodes-langchain.vectorStoreMilvus': {
    outputs: ['ai_vectorStore', 'ai_tool'],
    inputs: ['ai_embedding', 'ai_document']
  },
  '@n8n/n8n-nodes-langchain.vectorStoreZep': {
    outputs: ['ai_vectorStore', 'ai_tool'],
    inputs: ['ai_embedding', 'ai_document']
  },
  '@n8n/n8n-nodes-langchain.vectorStoreQdrant': {
    outputs: ['ai_vectorStore', 'ai_tool'],
    inputs: ['ai_embedding', 'ai_document']
  },
  '@n8n/n8n-nodes-langchain.vectorStoreInMemory': {
    outputs: ['ai_vectorStore', 'ai_tool'],
    inputs: ['ai_embedding', 'ai_document']
  },
  '@n8n/n8n-nodes-langchain.vectorStorePostgres': {
    outputs: ['ai_vectorStore', 'ai_tool'],
    inputs: ['ai_embedding', 'ai_document']
  },
  '@n8n/n8n-nodes-langchain.vectorStoreChroma': {
    outputs: ['ai_vectorStore', 'ai_tool'],
    inputs: ['ai_embedding', 'ai_document']
  },

  // ========================================
  // DOCUMENT LOADERS
  // ========================================
  '@n8n/n8n-nodes-langchain.documentDefaultDataLoader': {
    outputs: ['ai_document'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.documentBinaryLoader': {
    outputs: ['ai_document'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.documentJsonLoader': {
    outputs: ['ai_document'],
    inputs: []
  },

  // ========================================
  // TEXT SPLITTERS
  // ========================================
  '@n8n/n8n-nodes-langchain.textSplitterCharacterSplitter': {
    outputs: ['ai_textSplitter'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.textSplitterRecursiveCharacterSplitter': {
    outputs: ['ai_textSplitter'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.textSplitterTokenSplitter': {
    outputs: ['ai_textSplitter'],
    inputs: []
  },

  // ========================================
  // RETRIEVERS
  // ========================================
  '@n8n/n8n-nodes-langchain.retrieverVectorStore': {
    outputs: ['ai_tool'], // Retrievers output as tools for agents
    inputs: ['ai_vectorStore', 'ai_embedding']
  },
  '@n8n/n8n-nodes-langchain.retrieverWorkflow': {
    outputs: ['ai_tool'],
    inputs: []
  },

  // ========================================
  // OUTPUT PARSERS
  // ========================================
  '@n8n/n8n-nodes-langchain.outputParserStructured': {
    outputs: ['ai_outputParser'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.outputParserAutofixing': {
    outputs: ['ai_outputParser'],
    inputs: ['ai_languageModel']
  },

  // ========================================
  // REGULAR BASE NODES (all use 'main' port)
  // ========================================
  // Triggers
  'n8n-nodes-base.manualTrigger': {
    outputs: ['main'],
    inputs: []
  },
  'n8n-nodes-base.webhook': {
    outputs: ['main'],
    inputs: []
  },
  'n8n-nodes-base.scheduleTrigger': {
    outputs: ['main'],
    inputs: []
  },
  'n8n-nodes-base.errorTrigger': {
    outputs: ['main'],
    inputs: []
  },
  'n8n-nodes-base.executeWorkflowTrigger': {
    outputs: ['main'],
    inputs: []
  },
  'n8n-nodes-base.formTrigger': {
    outputs: ['main'],
    inputs: []
  },

  // AI Chat Triggers
  '@n8n/n8n-nodes-langchain.chatTrigger': {
    outputs: ['main'],
    inputs: []
  },
  '@n8n/n8n-nodes-langchain.manualChatTrigger': {
    outputs: ['main'],
    inputs: []
  },

  // Core Actions
  'n8n-nodes-base.httpRequest': {
    outputs: ['main'],
    inputs: ['main']
  },
  'n8n-nodes-base.code': {
    outputs: ['main'],
    inputs: ['main']
  },
  'n8n-nodes-base.set': {
    outputs: ['main'],
    inputs: ['main']
  },
  'n8n-nodes-base.merge': {
    outputs: ['main'],
    inputs: ['main']
  },
  'n8n-nodes-base.if': {
    outputs: ['main'],
    inputs: ['main']
  },
  'n8n-nodes-base.switch': {
    outputs: ['main'],
    inputs: ['main']
  },
  'n8n-nodes-base.executeWorkflow': {
    outputs: ['main'],
    inputs: ['main']
  },

  // AI Transform
  'n8n-nodes-base.aiTransform': {
    outputs: ['main'],
    inputs: ['main', 'ai_languageModel']
  },

  // Sticky Note (no connections)
  'n8n-nodes-base.stickyNote': {
    outputs: [],
    inputs: []
  },

  // NoOp
  'n8n-nodes-base.noOp': {
    outputs: ['main'],
    inputs: ['main']
  },
};

/**
 * Get port capabilities for a node type
 * Returns capabilities if defined, otherwise returns default (main in/out)
 */
export function getPortCapabilities(nodeType: string): PortCapabilities {
  // Exact match
  if (PORT_CAPABILITIES[nodeType]) {
    return PORT_CAPABILITIES[nodeType];
  }

  // Pattern matching for service TOOL nodes (e.g., googleSheetsTool, gmailTool)
  // These are n8n-nodes-base service integrations designed to connect to AI agents
  // They output on ai_tool port, not main
  if (nodeType.startsWith('n8n-nodes-base.') && nodeType.endsWith('Tool')) {
    return {
      outputs: ['ai_tool'],
      inputs: []
    };
  }

  // Pattern matching for regular service nodes not explicitly defined
  // All regular service nodes (Gmail, Slack, etc.) use main ports
  if (nodeType.startsWith('n8n-nodes-base.') && !nodeType.includes('langchain')) {
    return {
      outputs: ['main'],
      inputs: ['main']
    };
  }

  // Default fallback: main in/out
  return {
    outputs: ['main'],
    inputs: ['main']
  };
}

/**
 * Check if a node type can output on a specific port type
 */
export function canOutputOnPort(nodeType: string, portType: string): boolean {
  const capabilities = getPortCapabilities(nodeType);
  return capabilities.outputs.includes(portType);
}

/**
 * Check if a node type can accept input on a specific port type
 */
export function canAcceptInputOnPort(nodeType: string, portType: string): boolean {
  const capabilities = getPortCapabilities(nodeType);
  return capabilities.inputs.includes(portType);
}

/**
 * Get valid output ports for a node type
 */
export function getValidOutputPorts(nodeType: string): string[] {
  return getPortCapabilities(nodeType).outputs;
}

/**
 * Get valid input ports for a node type
 */
export function getValidInputPorts(nodeType: string): string[] {
  return getPortCapabilities(nodeType).inputs;
}

/**
 * Get all AI-specific port types
 */
export const AI_PORT_TYPES = [
  'ai_languageModel',
  'ai_memory',
  'ai_tool',
  'ai_embedding',
  'ai_vectorStore',
  'ai_outputParser',
  'ai_retriever',
  'ai_document',
  'ai_textSplitter',
  'ai_agent'
] as const;

/**
 * Check if a port type is an AI-specific port
 */
export function isAIPort(portType: string): boolean {
  return AI_PORT_TYPES.includes(portType as any);
}
