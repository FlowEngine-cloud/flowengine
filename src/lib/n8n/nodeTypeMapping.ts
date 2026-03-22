/**
 * N8N Node Type Mapping - DEPRECATED vs MODERN
 *
 * This file provides clear mapping between old/deprecated node types
 * and their modern equivalents to prevent AI from using wrong nodes.
 *
 * Sources:
 * - n8n-workflow package (Constants.js)
 * - @n8n/n8n-nodes-langchain package
 * - n8n official documentation
 */

/**
 * DEPRECATED NODE TYPES - DO NOT USE
 * These exist in n8n-workflow but should NOT be used in modern workflows
 */
export const DEPRECATED_NODES = {
  // ❌ DEPRECATED: Old OpenAI language model node
  // Used only for legacy LLM chains, NOT for AI agents
  OLD_OPENAI_LLM: '@n8n/n8n-nodes-langchain.openAi',
} as const;

/**
 * MODERN NODE TYPES - USE THESE
 * These are the current, properly supported node types
 */
export const MODERN_NODES = {
  // ⭐ FLOWENGINE: Pre-configured LLM Chat Model (PREFERRED - no API key needed)
  // This is the LangChain Chat Model node from FlowEngine custom package
  FLOWENGINE_LLM: 'CUSTOM.flowEngineLlm',

  // ✅ MODERN: Chat Model Nodes (for AI Agents) - ALL PROVIDERS
  OPENAI_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
  ANTHROPIC_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatAnthropic',
  GOOGLE_GEMINI_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  GOOGLE_VERTEX_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatGoogleVertex',
  AZURE_OPENAI_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatAzureOpenAi',
  MISTRAL_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatMistralCloud',
  COHERE_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatCohere',
  GROQ_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatGroq',
  OLLAMA_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatOllama',
  AWS_BEDROCK_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatAwsBedrock',
  LEMONADE_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatLemonade',
  DEEPSEEK_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatDeepSeek',
  OPENROUTER_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatOpenRouter',
  VERCEL_AI_GATEWAY_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatVercelAiGateway',
  XAI_GROK_CHAT_MODEL: '@n8n/n8n-nodes-langchain.lmChatXAiGrok',

  // ✅ MODERN: Memory Node (MANDATORY for AI agents)
  MEMORY_BUFFER_WINDOW: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  MEMORY_CHAT: '@n8n/n8n-nodes-langchain.memoryChatMemory',
  MEMORY_MANAGER: '@n8n/n8n-nodes-langchain.memoryManager',
  MEMORY_REDIS: '@n8n/n8n-nodes-langchain.memoryRedisChat',
  MEMORY_XATA: '@n8n/n8n-nodes-langchain.memoryXata',
  MEMORY_POSTGRES: '@n8n/n8n-nodes-langchain.memoryPostgresChat',

  // ✅ MODERN: AI Agent
  AI_AGENT: '@n8n/n8n-nodes-langchain.agent',

  // ✅ MODERN: AI Tools
  CODE_TOOL: '@n8n/n8n-nodes-langchain.toolCode',
  HTTP_REQUEST_TOOL: '@n8n/n8n-nodes-langchain.toolHttpRequest',
  WORKFLOW_TOOL: '@n8n/n8n-nodes-langchain.toolWorkflow',
  // NOTE: toolAgent does NOT exist - use toolCode for specialists instead
  CALCULATOR_TOOL: '@n8n/n8n-nodes-langchain.toolCalculator',
  WIKIPEDIA_TOOL: '@n8n/n8n-nodes-langchain.toolWikipedia',
  SERP_API_TOOL: '@n8n/n8n-nodes-langchain.toolSerpApi',
  WOLFRAM_ALPHA_TOOL: '@n8n/n8n-nodes-langchain.toolWolframAlpha',
  MCP_CLIENT_TOOL: '@n8n/n8n-nodes-langchain.mcpClientTool',

  // ✅ MODERN: Output Parsers
  OUTPUT_PARSER_STRUCTURED: '@n8n/n8n-nodes-langchain.outputParserStructured',
  OUTPUT_PARSER_AUTO_FIXING: '@n8n/n8n-nodes-langchain.outputParserAutofixing',
  OUTPUT_PARSER_ITEM_LIST: '@n8n/n8n-nodes-langchain.outputParserItemList',

  // ✅ MODERN: Triggers
  MANUAL_CHAT_TRIGGER: '@n8n/n8n-nodes-langchain.manualChatTrigger',
  MANUAL_TRIGGER: 'n8n-nodes-base.manualTrigger',
  WEBHOOK: 'n8n-nodes-base.webhook',
  MCP_TRIGGER: '@n8n/n8n-nodes-langchain.mcpTrigger',

  // ✅ MODERN: MCP (Model Context Protocol) nodes
  MCP_CLIENT: '@n8n/n8n-nodes-langchain.mcpClient',
} as const;

/**
 * Node Type Replacements - Automatic Migration Map
 */
export const NODE_TYPE_REPLACEMENTS: Record<string, string | null> = {
  // Replace deprecated OpenAI node with modern chat model
  [DEPRECATED_NODES.OLD_OPENAI_LLM]: MODERN_NODES.OPENAI_CHAT_MODEL,

  // Also catch common mistakes/variations
  'n8n-nodes-langchain.openAi': MODERN_NODES.OPENAI_CHAT_MODEL,

  // Incorrect memory node types that might be generated
  'n8n-nodes-base.httpRequest': null, // Will be caught by context - should be memory if connected to agent
};

/**
 * Chat Model Providers - All Modern Options
 */
export const CHAT_MODEL_NODES = [
  MODERN_NODES.FLOWENGINE_LLM, // ⭐ FlowEngine LLM (preferred - pre-configured)
  MODERN_NODES.OPENAI_CHAT_MODEL,
  MODERN_NODES.ANTHROPIC_CHAT_MODEL,
  MODERN_NODES.GOOGLE_GEMINI_CHAT_MODEL,
  MODERN_NODES.GOOGLE_VERTEX_CHAT_MODEL,
  MODERN_NODES.AZURE_OPENAI_CHAT_MODEL,
  MODERN_NODES.MISTRAL_CHAT_MODEL,
  MODERN_NODES.COHERE_CHAT_MODEL,
  MODERN_NODES.GROQ_CHAT_MODEL,
  MODERN_NODES.OLLAMA_CHAT_MODEL,
  MODERN_NODES.AWS_BEDROCK_CHAT_MODEL,
  MODERN_NODES.LEMONADE_CHAT_MODEL,
  MODERN_NODES.DEEPSEEK_CHAT_MODEL,
  MODERN_NODES.OPENROUTER_CHAT_MODEL,
  MODERN_NODES.VERCEL_AI_GATEWAY_CHAT_MODEL,
  MODERN_NODES.XAI_GROK_CHAT_MODEL,
] as const;

/**
 * Memory Node Types - All Available Options
 */
export const MEMORY_NODES = [
  MODERN_NODES.MEMORY_BUFFER_WINDOW,
  MODERN_NODES.MEMORY_CHAT,
  MODERN_NODES.MEMORY_MANAGER,
  MODERN_NODES.MEMORY_REDIS,
  MODERN_NODES.MEMORY_XATA,
  MODERN_NODES.MEMORY_POSTGRES,
] as const;

/**
 * AI Tool Node Types - All Available Options
 */
export const TOOL_NODES = [
  MODERN_NODES.CODE_TOOL,
  MODERN_NODES.HTTP_REQUEST_TOOL,
  MODERN_NODES.WORKFLOW_TOOL,
  // AI_AGENT_TOOL removed - does not exist
  MODERN_NODES.CALCULATOR_TOOL,
  MODERN_NODES.WIKIPEDIA_TOOL,
  MODERN_NODES.SERP_API_TOOL,
  MODERN_NODES.WOLFRAM_ALPHA_TOOL,
  MODERN_NODES.MCP_CLIENT_TOOL,
] as const;

/**
 * Check if a node type is deprecated
 */
export function isDeprecatedNode(nodeType: string): boolean {
  return Object.values(DEPRECATED_NODES).includes(nodeType as any);
}

/**
 * Get modern replacement for a deprecated node type
 */
export function getModernReplacement(nodeType: string): string | null {
  return NODE_TYPE_REPLACEMENTS[nodeType] || null;
}

/**
 * Check if a node type is a valid chat model
 */
export function isChatModelNode(nodeType: string): boolean {
  // Check exact match first
  if (CHAT_MODEL_NODES.includes(nodeType as any)) return true;
  // Also check substring patterns for custom/FlowEngine nodes
  return nodeType.includes('lmChat') ||
         nodeType.includes('ChatModel') ||
         nodeType.includes('flowEngineLlm') ||
         nodeType.includes('flowEngine') ||
         nodeType.startsWith('CUSTOM.');
}

/**
 * Check if a node type is the AI agent
 */
export function isAIAgentNode(nodeType: string): boolean {
  return nodeType === MODERN_NODES.AI_AGENT;
}

/**
 * Check if a node type is a memory node
 */
export function isMemoryNode(nodeType: string): boolean {
  return MEMORY_NODES.includes(nodeType as any);
}

/**
 * Check if a node type is a tool node
 */
export function isToolNode(nodeType: string): boolean {
  return TOOL_NODES.includes(nodeType as any);
}

// isAIAgentTool removed - toolAgent node type does not exist in n8n

/**
 * Get proper node name suggestions based on type
 */
export function getSuggestedNodeName(nodeType: string): string {
  const nameMap: Record<string, string> = {
    // Chat Models
    [MODERN_NODES.FLOWENGINE_LLM]: 'FlowEngine LLM Chat Model',
    [MODERN_NODES.OPENAI_CHAT_MODEL]: 'OpenAI Chat Model',
    [MODERN_NODES.ANTHROPIC_CHAT_MODEL]: 'Anthropic Chat Model',
    [MODERN_NODES.GOOGLE_GEMINI_CHAT_MODEL]: 'Google Gemini Chat Model',
    [MODERN_NODES.GOOGLE_VERTEX_CHAT_MODEL]: 'Google Vertex Chat Model',
    [MODERN_NODES.AZURE_OPENAI_CHAT_MODEL]: 'Azure OpenAI Chat Model',
    [MODERN_NODES.MISTRAL_CHAT_MODEL]: 'Mistral Chat Model',
    [MODERN_NODES.COHERE_CHAT_MODEL]: 'Cohere Chat Model',
    [MODERN_NODES.GROQ_CHAT_MODEL]: 'Groq Chat Model',
    [MODERN_NODES.OLLAMA_CHAT_MODEL]: 'Ollama Chat Model',
    [MODERN_NODES.AWS_BEDROCK_CHAT_MODEL]: 'AWS Bedrock Chat Model',
    [MODERN_NODES.LEMONADE_CHAT_MODEL]: 'Lemonade Chat Model',
    [MODERN_NODES.DEEPSEEK_CHAT_MODEL]: 'DeepSeek Chat Model',
    [MODERN_NODES.OPENROUTER_CHAT_MODEL]: 'OpenRouter Chat Model',
    [MODERN_NODES.VERCEL_AI_GATEWAY_CHAT_MODEL]: 'Vercel AI Gateway Chat Model',
    [MODERN_NODES.XAI_GROK_CHAT_MODEL]: 'xAI Grok Chat Model',

    // Memory
    [MODERN_NODES.MEMORY_BUFFER_WINDOW]: 'Simple Memory',
    [MODERN_NODES.MEMORY_CHAT]: 'Simple Memory',
    [MODERN_NODES.MEMORY_MANAGER]: 'Memory Manager',
    [MODERN_NODES.MEMORY_REDIS]: 'Redis Memory',
    [MODERN_NODES.MEMORY_XATA]: 'Xata Memory',
    [MODERN_NODES.MEMORY_POSTGRES]: 'PostgreSQL Memory',

    // AI Agent
    [MODERN_NODES.AI_AGENT]: 'AI Agent',

    // Tools
    [MODERN_NODES.CODE_TOOL]: 'Code Tool',
    [MODERN_NODES.HTTP_REQUEST_TOOL]: 'HTTP Request Tool',
    [MODERN_NODES.WORKFLOW_TOOL]: 'Workflow Tool',
    // AI_AGENT_TOOL removed - does not exist
    [MODERN_NODES.CALCULATOR_TOOL]: 'Calculator Tool',
    [MODERN_NODES.WIKIPEDIA_TOOL]: 'Wikipedia Tool',
    [MODERN_NODES.SERP_API_TOOL]: 'Search Tool',
    [MODERN_NODES.WOLFRAM_ALPHA_TOOL]: 'Wolfram Alpha Tool',
    [MODERN_NODES.MCP_CLIENT_TOOL]: 'MCP Client Tool',

    // Output Parsers
    [MODERN_NODES.OUTPUT_PARSER_STRUCTURED]: 'Structured Output Parser',
    [MODERN_NODES.OUTPUT_PARSER_AUTO_FIXING]: 'Auto-Fixing Parser',
    [MODERN_NODES.OUTPUT_PARSER_ITEM_LIST]: 'Item List Parser',

    // Triggers
    [MODERN_NODES.MANUAL_CHAT_TRIGGER]: 'Manual Chat Trigger',
    [MODERN_NODES.MCP_TRIGGER]: 'MCP Server Trigger',

    // MCP
    [MODERN_NODES.MCP_CLIENT]: 'MCP Client',
  };

  return nameMap[nodeType] || 'Node';
}

/**
 * Validation Rules for AI Agent Workflows
 */
export const AI_AGENT_REQUIREMENTS = {
  // Every AI agent MUST have these connections
  REQUIRED_CONNECTIONS: {
    ai_languageModel: {
      description: 'Chat model (any LLM provider)',
      validNodeTypes: CHAT_MODEL_NODES,
      count: { min: 1, max: 1 },
    },
    ai_memory: {
      description: 'Memory node (any memory type)',
      validNodeTypes: MEMORY_NODES,
      count: { min: 1, max: 1 },
    },
    ai_tool: {
      description: 'At least one tool (code, http, agent, calculator, etc.)',
      validNodeTypes: TOOL_NODES,
      count: { min: 1, max: 999 },
    },
    ai_outputParser: {
      description: 'Optional: Output parser for structured responses',
      validNodeTypes: [
        MODERN_NODES.OUTPUT_PARSER_STRUCTURED,
        MODERN_NODES.OUTPUT_PARSER_AUTO_FIXING,
        MODERN_NODES.OUTPUT_PARSER_ITEM_LIST,
      ],
      count: { min: 0, max: 1 },
      optional: true,
    },
  },
} as const;

/**
 * Get AI agent validation requirements as a readable string
 */
export function getAIAgentRequirementsText(): string {
  return `
AI Agent MANDATORY Requirements:
1. Language Model: ONE of [${CHAT_MODEL_NODES.join(', ')}]
2. Memory: ONE ${MODERN_NODES.MEMORY_BUFFER_WINDOW} (NO EXCEPTIONS!)
3. Tools: AT LEAST ONE tool node

Connection Types:
- Language Model → AI Agent via "ai_languageModel"
- Memory → AI Agent via "ai_memory"
- Tools → AI Agent via "ai_tool"
`.trim();
}
