/**
 * Comprehensive N8N Node Registry
 *
 * This file provides a user-friendly interface to nodeCategories.generated.ts,
 * which is the SINGLE SOURCE OF TRUTH for all n8n node types.
 *
 * Source: nodeCategories.generated.ts (632+ validated nodes, updated for n8n v2.2+)
 * Last update: January 2026
 * New in v2.x: ModelSelector, ToolExecutor, RerankerCohere, EmbeddingsLemonade
 *
 * Note: Constants are defined directly because n8n-workflow has Node.js dependencies
 * that cannot be bundled for Next.js browser/edge runtime.
 */

import { NODE_CATEGORIES_BY_USAGE, ALL_NODES } from './nodeCategories.generated';

// LangChain node type constants (from n8n-workflow/constants)
// Defined directly to avoid bundling issues with n8n-workflow's Node.js dependencies
const CHAT_TRIGGER_NODE_TYPE = '@n8n/n8n-nodes-langchain.chatTrigger';
const MANUAL_CHAT_TRIGGER_LANGCHAIN_NODE_TYPE = '@n8n/n8n-nodes-langchain.manualChatTrigger';
const AGENT_LANGCHAIN_NODE_TYPE = '@n8n/n8n-nodes-langchain.agent';
const CHAIN_LLM_LANGCHAIN_NODE_TYPE = '@n8n/n8n-nodes-langchain.chainLlm';
const OPENAI_LANGCHAIN_NODE_TYPE = '@n8n/n8n-nodes-langchain.lmOpenAi';
const CHAIN_SUMMARIZATION_LANGCHAIN_NODE_TYPE = '@n8n/n8n-nodes-langchain.chainSummarization';
const CODE_TOOL_LANGCHAIN_NODE_TYPE = '@n8n/n8n-nodes-langchain.toolCode';
const WORKFLOW_TOOL_LANGCHAIN_NODE_TYPE = '@n8n/n8n-nodes-langchain.toolWorkflow';
const HTTP_REQUEST_TOOL_LANGCHAIN_NODE_TYPE = '@n8n/n8n-nodes-langchain.toolHttpRequest';

/**
 * Common node type constants for convenience.
 * These are the most frequently used nodes, provided for easier code readability.
 *
 * IMPORTANT: These are NOT the complete list - use getAllNodeTypes() or NODE_CATEGORIES_BY_USAGE
 * from nodeCategories.generated.ts for the complete 625+ node registry.
 */
export const BASE_NODES = {
  // Core utilities
  STICKY_NOTE: 'n8n-nodes-base.stickyNote',
  NO_OP: 'n8n-nodes-base.noOp',
  WAIT: 'n8n-nodes-base.wait',

  // Triggers
  MANUAL_TRIGGER: 'n8n-nodes-base.manualTrigger',
  WEBHOOK: 'n8n-nodes-base.webhook',
  ERROR_TRIGGER: 'n8n-nodes-base.errorTrigger',
  START: 'n8n-nodes-base.start',
  EXECUTE_WORKFLOW_TRIGGER: 'n8n-nodes-base.executeWorkflowTrigger',
  FORM_TRIGGER: 'n8n-nodes-base.formTrigger',

  // HTTP & Requests
  HTTP_REQUEST: 'n8n-nodes-base.httpRequest',

  // Code & Processing
  CODE: 'n8n-nodes-base.code',
  FUNCTION: 'n8n-nodes-base.function',
  FUNCTION_ITEM: 'n8n-nodes-base.functionItem',
  AI_TRANSFORM: 'n8n-nodes-base.aiTransform',

  // Data Operations
  MERGE: 'n8n-nodes-base.merge',
  SET: 'n8n-nodes-base.set',

  // Workflow Control
  EXECUTE_WORKFLOW: 'n8n-nodes-base.executeWorkflow',

  // Forms
  FORM: 'n8n-nodes-base.form',
} as const;

// LangChain AI Nodes (from n8n-workflow)
export const AI_NODES = {
  // Triggers
  CHAT_TRIGGER: CHAT_TRIGGER_NODE_TYPE,
  MANUAL_CHAT_TRIGGER: MANUAL_CHAT_TRIGGER_LANGCHAIN_NODE_TYPE,

  // AI Agents & Models
  AGENT: AGENT_LANGCHAIN_NODE_TYPE,
  CHAIN_LLM: CHAIN_LLM_LANGCHAIN_NODE_TYPE,
  OPENAI: OPENAI_LANGCHAIN_NODE_TYPE,
  CHAIN_SUMMARIZATION: CHAIN_SUMMARIZATION_LANGCHAIN_NODE_TYPE,

  // AI Tools
  CODE_TOOL: CODE_TOOL_LANGCHAIN_NODE_TYPE,
  WORKFLOW_TOOL: WORKFLOW_TOOL_LANGCHAIN_NODE_TYPE,
  HTTP_REQUEST_TOOL: HTTP_REQUEST_TOOL_LANGCHAIN_NODE_TYPE,
} as const;

// Common Service Nodes (convenience constants for most popular services)
export const SERVICE_NODES = {
  // Communication
  GMAIL: 'n8n-nodes-base.gmail',
  SLACK: 'n8n-nodes-base.slack',
  DISCORD: 'n8n-nodes-base.discord',
  MICROSOFT_TEAMS: 'n8n-nodes-base.microsoftTeams',
  TELEGRAM: 'n8n-nodes-base.telegram',

  // Social Media
  TWITTER: 'n8n-nodes-base.twitter',
  LINKEDIN: 'n8n-nodes-base.linkedIn',
  FACEBOOK: 'n8n-nodes-base.facebookPages',
  INSTAGRAM: 'n8n-nodes-base.instagram',

  // Productivity
  GOOGLE_SHEETS: 'n8n-nodes-base.googleSheets',
  GOOGLE_DOCS: 'n8n-nodes-base.googleDocs',
  GOOGLE_DRIVE: 'n8n-nodes-base.googleDrive',
  NOTION: 'n8n-nodes-base.notion',
  AIRTABLE: 'n8n-nodes-base.airtable',
  TRELLO: 'n8n-nodes-base.trello',
  ASANA: 'n8n-nodes-base.asana',

  // Development
  GITHUB: 'n8n-nodes-base.github',
  GITLAB: 'n8n-nodes-base.gitLab',
  JIRA: 'n8n-nodes-base.jira',

  // Scheduling
  SCHEDULE_TRIGGER: 'n8n-nodes-base.scheduleTrigger',
  CRON: 'n8n-nodes-base.cron',

  // Databases
  MYSQL: 'n8n-nodes-base.mySql',
  POSTGRES: 'n8n-nodes-base.postgres',
  MONGODB: 'n8n-nodes-base.mongoDb',
  REDIS: 'n8n-nodes-base.redis',

  // Cloud Storage
  AWS_S3: 'n8n-nodes-base.awsS3',
  DROPBOX: 'n8n-nodes-base.dropbox',

  // E-commerce
  SHOPIFY: 'n8n-nodes-base.shopify',
  STRIPE: 'n8n-nodes-base.stripe',

  // CRM
  HUBSPOT: 'n8n-nodes-base.hubspot',
  SALESFORCE: 'n8n-nodes-base.salesforce',

  // Analytics
  GOOGLE_ANALYTICS: 'n8n-nodes-base.googleAnalytics',

  // File Processing
  PDF: 'n8n-nodes-base.pdf',
  CSV: 'n8n-nodes-base.csv',
  XML: 'n8n-nodes-base.xml',
  JSON: 'n8n-nodes-base.json',
} as const;

/**
 * Legacy NODE_CATEGORIES export for backward compatibility.
 *
 * @deprecated Use NODE_CATEGORIES_BY_USAGE from nodeCategories.generated.ts instead.
 * This provides the complete categorized list of all 614 nodes.
 */
export const NODE_CATEGORIES = {
  triggers: [
    BASE_NODES.MANUAL_TRIGGER,
    BASE_NODES.WEBHOOK,
    BASE_NODES.ERROR_TRIGGER,
    BASE_NODES.EXECUTE_WORKFLOW_TRIGGER,
    BASE_NODES.FORM_TRIGGER,
    SERVICE_NODES.SCHEDULE_TRIGGER,
    AI_NODES.CHAT_TRIGGER,
    AI_NODES.MANUAL_CHAT_TRIGGER,
  ],
  actions: [
    BASE_NODES.HTTP_REQUEST,
    BASE_NODES.CODE,
    BASE_NODES.SET,
    BASE_NODES.MERGE,
    BASE_NODES.EXECUTE_WORKFLOW,
  ],
  ai: [
    BASE_NODES.AI_TRANSFORM,
    AI_NODES.AGENT,
    AI_NODES.OPENAI,
    AI_NODES.CHAIN_LLM,
    AI_NODES.CHAIN_SUMMARIZATION,
  ],
  tools: [
    AI_NODES.CODE_TOOL,
    AI_NODES.WORKFLOW_TOOL,
    AI_NODES.HTTP_REQUEST_TOOL,
  ],
  communication: [
    SERVICE_NODES.GMAIL,
    SERVICE_NODES.SLACK,
    SERVICE_NODES.DISCORD,
    SERVICE_NODES.MICROSOFT_TEAMS,
    SERVICE_NODES.TELEGRAM,
  ],
  social: [
    SERVICE_NODES.TWITTER,
    SERVICE_NODES.LINKEDIN,
    SERVICE_NODES.FACEBOOK,
    SERVICE_NODES.INSTAGRAM,
  ],
  productivity: [
    SERVICE_NODES.GOOGLE_SHEETS,
    SERVICE_NODES.NOTION,
    SERVICE_NODES.AIRTABLE,
    SERVICE_NODES.TRELLO,
  ],
} as const;

/**
 * Get all available node types from the complete registry.
 *
 * @returns Array of all 632+ validated node types (updated for n8n v2.2+)
 */
export function getAllNodeTypes(): string[] {
  return [...ALL_NODES];
}

/**
 * Check if a node type is valid against the complete registry.
 *
 * @param nodeType - The node type to validate (e.g., "n8n-nodes-base.gmail")
 * @param strict - If true (default), only accept nodes in registry. If false, also accept pattern matches.
 * @returns true if the node exists in the n8n v2.2+ registry (or matches pattern if not strict)
 */
export function isValidNodeType(nodeType: string, strict: boolean = true): boolean {
  // Check the complete generated list (625+ nodes)
  if (ALL_NODES.includes(nodeType)) {
    return true;
  }

  // In strict mode (default), reject nodes not in registry
  // This catches AI-hallucinated fake nodes like "n8n-nodes-base.formTriggerResponse"
  if (strict) {
    return false;
  }

  // In lenient mode (for analyzer), accept nodes following n8n naming conventions
  // This avoids false positives when users submit workflows with valid nodes not in our registry
  return nodeType.startsWith('@n8n/n8n-nodes-langchain.') || nodeType.startsWith('n8n-nodes-base.');
}

/**
 * Get suggested node type based on description.
 *
 * @deprecated Use findSimilarNodeInCategory() instead - this function has hardcoded patterns
 * and only covers ~30 nodes out of 614. The new function searches the entire registry dynamically.
 */
export function suggestNodeType(description: string): string {
  const desc = description.toLowerCase();

  // AI-related
  if (desc.includes('ai agent') || desc.includes('assistant')) return AI_NODES.AGENT;
  if (desc.includes('openai') || desc.includes('gpt')) return AI_NODES.OPENAI;
  if (desc.includes('ai transform') || desc.includes('ai data')) return BASE_NODES.AI_TRANSFORM;

  // Triggers
  if (desc.includes('manual trigger') || desc.includes('start')) return BASE_NODES.MANUAL_TRIGGER;
  if (desc.includes('webhook') || desc.includes('http trigger')) return BASE_NODES.WEBHOOK;
  if (desc.includes('schedule') || desc.includes('cron') || desc.includes('timer')) return SERVICE_NODES.SCHEDULE_TRIGGER;
  if (desc.includes('chat trigger')) return AI_NODES.CHAT_TRIGGER;

  // Communication
  if (desc.includes('gmail') || desc.includes('email')) return SERVICE_NODES.GMAIL;
  if (desc.includes('slack')) return SERVICE_NODES.SLACK;
  if (desc.includes('discord')) return SERVICE_NODES.DISCORD;
  if (desc.includes('teams')) return SERVICE_NODES.MICROSOFT_TEAMS;
  if (desc.includes('telegram')) return SERVICE_NODES.TELEGRAM;

  // Social Media
  if (desc.includes('twitter') || desc.includes('tweet')) return SERVICE_NODES.TWITTER;
  if (desc.includes('linkedin')) return SERVICE_NODES.LINKEDIN;
  if (desc.includes('facebook')) return SERVICE_NODES.FACEBOOK;
  if (desc.includes('instagram')) return SERVICE_NODES.INSTAGRAM;

  // Productivity
  if (desc.includes('google sheets') || desc.includes('spreadsheet')) return SERVICE_NODES.GOOGLE_SHEETS;
  if (desc.includes('notion')) return SERVICE_NODES.NOTION;
  if (desc.includes('airtable')) return SERVICE_NODES.AIRTABLE;
  if (desc.includes('trello')) return SERVICE_NODES.TRELLO;

  // Code & Processing
  if (desc.includes('code') || desc.includes('javascript')) return BASE_NODES.CODE;
  if (desc.includes('function')) return BASE_NODES.FUNCTION;
  if (desc.includes('merge') || desc.includes('combine')) return BASE_NODES.MERGE;
  if (desc.includes('set') || desc.includes('transform')) return BASE_NODES.SET;

  // HTTP
  if (desc.includes('http') || desc.includes('api') || desc.includes('request')) return BASE_NODES.HTTP_REQUEST;

  // Default
  return BASE_NODES.HTTP_REQUEST;
}

/**
 * Extract keywords from node type string
 * Example: "n8n-nodes-base.facebookPages" → ["facebook", "pages"]
 */
function extractKeywords(nodeType: string): string[] {
  // Remove prefixes
  const withoutPrefix = nodeType
    .replace('@n8n/n8n-nodes-langchain.', '')
    .replace('n8n-nodes-base.', '');

  // Split on capitals, numbers, and special chars
  const words = withoutPrefix
    .replace(/([A-Z])/g, ' $1') // Split camelCase
    .replace(/([0-9]+)/g, ' $1') // Split numbers
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2); // Minimum 3 chars

  return words;
}

/**
 * Calculate similarity score between a valid node and keywords
 * Higher score = better match
 */
function calculateSimilarity(validNode: string, keywords: string[]): number {
  const validLower = validNode.toLowerCase();
  let score = 0;

  for (const keyword of keywords) {
    if (validLower.includes(keyword)) {
      // Exact substring match
      score += keyword.length * 2;

      // Bonus if keyword is at word boundary
      const wordBoundaryRegex = new RegExp(`\\b${keyword}\\b`, 'i');
      if (wordBoundaryRegex.test(validNode)) {
        score += keyword.length;
      }
    }
  }

  return score;
}

/**
 * Find similar node in specific category using string similarity.
 * NO HARDCODED PATTERNS - searches entire category dynamically.
 *
 * @param invalidNodeType - The invalid node type (e.g., "n8n-nodes-base.facebookPages")
 * @param categoryKey - Registry category key (e.g., "aiTools", "regularNodes")
 * @returns Best matching valid node type or null if no good match found
 */
export function findSimilarNodeInCategory(
  invalidNodeType: string,
  categoryKey: string
): string | null {
  // Get nodes from target category
  const categoryNodes = NODE_CATEGORIES_BY_USAGE[categoryKey as keyof typeof NODE_CATEGORIES_BY_USAGE];
  if (!categoryNodes || !Array.isArray(categoryNodes)) {
    console.warn(`[findSimilarNode] Invalid category: ${categoryKey}`);
    return null;
  }

  // Extract keywords from invalid node type
  const keywords = extractKeywords(invalidNodeType);

  if (keywords.length === 0) {
    console.warn(`[findSimilarNode] No keywords extracted from: ${invalidNodeType}`);
    return null;
  }

  // Search for best matching node
  let bestMatch: string | null = null;
  let bestScore = 0;

  for (const validNode of categoryNodes) {
    const score = calculateSimilarity(validNode, keywords);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = validNode;
    }
  }

  // Only return match if score is meaningful (at least one keyword matched)
  if (bestScore > 0) {
    console.log(
      `[findSimilarNode] Found "${bestMatch}" for "${invalidNodeType}" in ${categoryKey} (score: ${bestScore})`
    );
    return bestMatch;
  }

  console.log(`[findSimilarNode] No similar node found for "${invalidNodeType}" in ${categoryKey}`);
  return null;
}

/**
 * Get comprehensive node examples for AI context.
 *
 * Generates a complete reference of all 625+ n8n nodes organized by category.
 * This is included in the AI prompt to help the model generate valid workflows.
 *
 * @returns Formatted markdown documentation of all available nodes
 */
export function getComprehensiveNodeExamples(): string {
  const categories = NODE_CATEGORIES_BY_USAGE;

  // Build comprehensive documentation from the complete registry
  return `
## COMPLETE N8N NODE REFERENCE
**Source:** n8n v2.2+ (632+ validated nodes, January 2026)
**New:** Guardrails (AI safety), MCP nodes, Lemonade LLM, DeepSeek, OpenRouter, xAI Grok, Azure AI Search

### 🚀 TRIGGERS (${categories.triggers.length} nodes)
Workflow entry points that start execution:

**Most Common:**
- n8n-nodes-base.manualTrigger - Manual workflow start
- n8n-nodes-base.webhook - HTTP webhook trigger
- n8n-nodes-base.scheduleTrigger - Time-based (cron) trigger
- @n8n/n8n-nodes-langchain.chatTrigger - AI chat trigger

**All ${categories.triggers.length} Triggers:**
${categories.triggers.map(node => `- ${node}`).join('\n')}

---

### 🎯 AI AGENTS (${categories.aiAgents.length} nodes)
Conversational AI agents that can use tools and memory:
${categories.aiAgents.map(node => `- ${node}`).join('\n')}

**Connection Requirements:**
- Agent MUST connect TO: ai_languageModel (required), ai_memory (required)
- Tools connect FROM agent: Agent --ai_tool--> Tool

---

### 🤖 AI LANGUAGE MODELS (${categories.aiModels.length} nodes)
LLM providers for AI agents:

⭐ **DEFAULT - USE THIS:**
- CUSTOM.flowEngineLlm - **FlowEngine LLM Chat Model (DEFAULT - pre-configured, no API key needed)**

**Other providers (ONLY when user explicitly requests):**
${categories.aiModels.filter(node => node !== 'CUSTOM.flowEngineLlm').map(node => `- ${node}`).join('\n')}

🚨 **CRITICAL:** Always use CUSTOM.flowEngineLlm unless user explicitly asks for OpenAI/GPT, Claude, or Gemini!

---

### 🧠 AI MEMORIES (${categories.aiMemories.length} nodes)
Memory systems for AI agents:
${categories.aiMemories.map(node => `- ${node}`).join('\n')}

---

### 🛡️ AI GUARDRAILS
Safety and content filtering for AI workflows:
- @n8n/n8n-nodes-langchain.guardrails - **AI Safety Node**

**Use Guardrails when:**
- Building public-facing chatbots
- Handling sensitive data (PII detection)
- Need to block jailbreak attempts, NSFW content, or specific keywords

**How it works:**
- Place BEFORE AI Agent to filter user input
- Or AFTER AI Agent to validate AI output
- Requires Chat Model connection for LLM-based checks

---

### 🔧 AI TOOLS (${categories.aiTools.length} nodes)
Tools that AI agents can use:

**LangChain Generic Tools (11):**
- @n8n/n8n-nodes-langchain.toolCalculator - Math calculations
- @n8n/n8n-nodes-langchain.toolCode - Code execution
- @n8n/n8n-nodes-langchain.toolHttpRequest - HTTP requests
- @n8n/n8n-nodes-langchain.toolWebScraper - Web scraping
- @n8n/n8n-nodes-langchain.toolWikipedia - Wikipedia search
- @n8n/n8n-nodes-langchain.toolWorkflow - Call other workflows
- (and 5 more...)

**Service-Specific Tools (${categories.aiTools.length - 11}):**
Popular: gmailTool, slackTool, githubTool, notionTool, googleSheetsTool, airtableTool, hubspotTool, salesforceTool, stripeTool, telegramTool...

**All ${categories.aiTools.length} AI Tools:**
${categories.aiTools.map(node => `- ${node}`).join('\n')}

---

### ⚙️ REGULAR ACTION NODES (${categories.regularNodes.length} nodes)

**Core Operations:**
- n8n-nodes-base.httpRequest - HTTP API requests
- n8n-nodes-base.code - JavaScript/Python code
- n8n-nodes-base.set - Data transformation
- n8n-nodes-base.merge - Combine data streams
- n8n-nodes-base.if - Conditional branching
- n8n-nodes-base.switch - Multi-way routing

**Communication (${categories.regularNodes.filter(n => n.includes('mail') || n.includes('slack') || n.includes('discord') || n.includes('telegram')).length}):**
- n8n-nodes-base.gmail - Gmail operations
- n8n-nodes-base.slack - Slack messaging
- n8n-nodes-base.discord - Discord operations
- n8n-nodes-base.telegram - Telegram bot
- n8n-nodes-base.microsoftTeams - Teams messaging

**Productivity (examples):**
- n8n-nodes-base.googleSheets - Google Sheets
- n8n-nodes-base.notion - Notion databases
- n8n-nodes-base.airtable - Airtable databases
- n8n-nodes-base.trello - Trello boards
- n8n-nodes-base.asana - Asana tasks

**Databases:**
- n8n-nodes-base.postgres - PostgreSQL
- n8n-nodes-base.mySql - MySQL
- n8n-nodes-base.mongoDb - MongoDB
- n8n-nodes-base.redis - Redis

**CRM & Business:**
- n8n-nodes-base.salesforce - Salesforce CRM
- n8n-nodes-base.hubspot - HubSpot CRM
- n8n-nodes-base.pipedrive - Pipedrive CRM

**E-commerce:**
- n8n-nodes-base.shopify - Shopify stores
- n8n-nodes-base.stripe - Payment processing
- n8n-nodes-base.wooCommerce - WooCommerce

**All ${categories.regularNodes.length} Regular Nodes:**
${categories.regularNodes.slice(0, 50).map(node => `- ${node}`).join('\n')}
... and ${categories.regularNodes.length - 50} more (see complete list in nodeCategories.generated.ts)

---

### 🎨 AI UTILITIES

**Vector Stores (${categories.aiVectorStores.length}):**
${categories.aiVectorStores.map(node => `- ${node}`).join('\n')}

**Embeddings (${categories.aiEmbeddings.length}):**
${categories.aiEmbeddings.map(node => `- ${node}`).join('\n')}

**Text Splitters (${categories.aiTextSplitters.length}):**
${categories.aiTextSplitters.map(node => `- ${node}`).join('\n')}

**Output Parsers (${categories.aiOutputParsers.length}):**
${categories.aiOutputParsers.map(node => `- ${node}`).join('\n')}

---

## 📊 SUMMARY
- **Total Nodes:** ${ALL_NODES.length}
- **Triggers:** ${categories.triggers.length}
- **Regular Nodes:** ${categories.regularNodes.length}
- **AI Agents:** ${categories.aiAgents.length}
- **AI Models:** ${categories.aiModels.length}
- **AI Memories:** ${categories.aiMemories.length}
- **AI Tools:** ${categories.aiTools.length}
- **Vector Stores:** ${categories.aiVectorStores.length}
- **Embeddings:** ${categories.aiEmbeddings.length}

**IMPORTANT:** Always use exact node type names from this list in workflows!
`;
}
