/**
 * Composite Node Requirements - AUTO-GENERATED
 * 
 * Analyzes node types from registry and infers composite requirements
 * based on naming patterns and connection types.
 */

import { ALL_NODES as VALID_NODE_TYPES } from './nodeCategories.generated';

export interface CompositeNodeTemplate {
  nodeType: string;
  requiredConnections: {
    connectionType: string;
    requiredNodeTypes: string[];
    isRequired: boolean;
  }[];
  defaultSubNodes?: {
    nodeType: string;
    connectionType: string;
    parameters?: Record<string, any>;
  }[];
}

/**
 * Connection type inference based on node naming patterns
 */
const CONNECTION_PATTERNS = {
  // Vector Store patterns
  vectorStore: {
    pattern: /vectorStore/i,
    requires: 'ai_embedding',
    candidates: VALID_NODE_TYPES.filter(t => t.includes('embeddings'))
  },
  
  // Tool patterns that wrap vector stores
  vectorStoreTool: {
    pattern: /toolVectorStore/i,
    requires: 'ai_vectorStore',
    candidates: VALID_NODE_TYPES.filter(t => t.includes('vectorStore') && !t.includes('Tool'))
  },
  
  // Agent patterns - only languageModel is required, memory is optional
  agent: {
    pattern: /\.agent$/i,
    requires: ['ai_languageModel'],  // Memory is OPTIONAL - not required
    candidates: {
      ai_languageModel: VALID_NODE_TYPES.filter(t => t.includes('lmChat'))
    }
  },
  
  // Agent tool wrapper
  agentTool: {
    pattern: /agentTool/i,
    requires: 'ai_agent',
    candidates: VALID_NODE_TYPES.filter(t => t.endsWith('.agent'))
  }
};

/**
 * Dynamically generate composite templates from node registry
 */
function generateCompositeTemplates(): Record<string, CompositeNodeTemplate> {
  const templates: Record<string, CompositeNodeTemplate> = {};
  
  for (const nodeType of VALID_NODE_TYPES) {
    const template = inferCompositeTemplate(nodeType);
    if (template) {
      templates[nodeType] = template;
    }
  }
  
  console.log(`[COMPOSITE-NODES] Generated ${Object.keys(templates).length} composite templates from ${VALID_NODE_TYPES.length} nodes`);
  return templates;
}

/**
 * Infer if a node type is composite and what it requires
 */
function inferCompositeTemplate(nodeType: string): CompositeNodeTemplate | null {
  const requiredConnections: any[] = [];
  const defaultSubNodes: any[] = [];
  
  // Check vector store tools
  if (CONNECTION_PATTERNS.vectorStoreTool.pattern.test(nodeType)) {
    requiredConnections.push({
      connectionType: 'ai_vectorStore',
      requiredNodeTypes: CONNECTION_PATTERNS.vectorStoreTool.candidates,
      isRequired: true
    });
    defaultSubNodes.push({
      nodeType: CONNECTION_PATTERNS.vectorStoreTool.candidates[0] || '@n8n/n8n-nodes-langchain.vectorStoreSupabase',
      connectionType: 'ai_vectorStore',
      parameters: {}
    });
  }
  
  // Check vector stores (need embeddings)
  if (CONNECTION_PATTERNS.vectorStore.pattern.test(nodeType) && !nodeType.includes('Tool')) {
    requiredConnections.push({
      connectionType: 'ai_embedding',
      requiredNodeTypes: CONNECTION_PATTERNS.vectorStore.candidates,
      isRequired: true
    });
    defaultSubNodes.push({
      nodeType: CONNECTION_PATTERNS.vectorStore.candidates[0] || '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
      connectionType: 'ai_embedding',
      parameters: {}
    });
  }
  
  // Check agents - only languageModel is required, memory is OPTIONAL
  if (CONNECTION_PATTERNS.agent.pattern.test(nodeType)) {
    requiredConnections.push({
      connectionType: 'ai_languageModel',
      requiredNodeTypes: CONNECTION_PATTERNS.agent.candidates.ai_languageModel,
      isRequired: true
    });
    // Memory is OPTIONAL - don't add as required
    // Default to FlowEngine LLM Chat Model (pre-configured, no API key needed)
    defaultSubNodes.push({
      nodeType: 'CUSTOM.flowEngineLlm',
      connectionType: 'ai_languageModel',
      parameters: { provider: 'openai', model: 'gpt-5-nano', options: {} }
    });
    // No default memory - only add if explicitly requested
  }
  
  // Check agent tools (wrap agents)
  if (CONNECTION_PATTERNS.agentTool.pattern.test(nodeType)) {
    requiredConnections.push({
      connectionType: 'ai_agent',
      requiredNodeTypes: CONNECTION_PATTERNS.agentTool.candidates,
      isRequired: true
    });
  }
  
  if (requiredConnections.length === 0) {
    return null; // Not a composite node
  }
  
  return {
    nodeType,
    requiredConnections,
    defaultSubNodes: defaultSubNodes.length > 0 ? defaultSubNodes : undefined
  };
}

/**
 * Lazy-loaded composite templates (generated on first access)
 */
let COMPOSITE_NODE_TEMPLATES: Record<string, CompositeNodeTemplate> | null = null;

function getTemplates(): Record<string, CompositeNodeTemplate> {
  if (!COMPOSITE_NODE_TEMPLATES) {
    COMPOSITE_NODE_TEMPLATES = generateCompositeTemplates();
  }
  return COMPOSITE_NODE_TEMPLATES;
}

/**
 * Check if a node type is a composite (requires sub-nodes)
 */
export function isCompositeNode(nodeType: string): boolean {
  const templates = getTemplates();
  return nodeType in templates;
}

/**
 * Get template for a composite node
 */
export function getCompositeTemplate(nodeType: string): CompositeNodeTemplate | null {
  const templates = getTemplates();
  return templates[nodeType] || null;
}
