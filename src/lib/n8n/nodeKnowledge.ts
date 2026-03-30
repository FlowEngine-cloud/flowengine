/**
 * Node Knowledge System
 * AUTO-GENERATED from node registry - ZERO hardcoding
 * Dynamically analyzes all 931 nodes and creates intelligent recommendations
 */

import { ALL_NODES as VALID_NODE_TYPES } from './nodeCategories.generated';

/**
 * Node capability patterns extracted from our node registry
 */
interface NodePattern {
  keywords: string[];
  recommendedNode: string;
  alternativeNode?: string;
  exampleParams?: Record<string, any>;
  reason: string;
}

/**
 * Dynamically generate node patterns from the registry
 * Extracts service names and creates keyword mappings
 */
function generateNodePatterns(): NodePattern[] {
  const patterns: NodePattern[] = [];
  
  // Category 1: LangChain Tool Nodes (for AI agents)
  const toolNodes = VALID_NODE_TYPES.filter(type => 
    type.includes('langchain') && type.toLowerCase().includes('tool')
  );
  
  for (const nodeType of toolNodes) {
    const toolName = nodeType.split('.').pop() || '';
    const cleanName = toolName.replace('tool', '').replace('Tool', '').toLowerCase();
    
    patterns.push({
      keywords: [toolName.toLowerCase(), cleanName, toolName],
      recommendedNode: nodeType,
      reason: `Use ${toolName} for AI agent capabilities`
    });
  }
  
  // Category 2: Service Nodes (Slack, Airtable, etc.)
  const serviceNodes = VALID_NODE_TYPES.filter(type => 
    type.includes('n8n-nodes-base.') && 
    !type.toLowerCase().includes('trigger') &&
    !type.includes('manual') &&
    !type.includes('webhook') &&
    !type.includes('httpRequest') &&
    !type.includes('set') &&
    !type.includes('merge') &&
    !type.includes('if') &&
    !type.includes('switch') &&
    !type.includes('code')
  );
  
  for (const nodeType of serviceNodes) {
    const serviceName = nodeType.replace('n8n-nodes-base.', '');
    const keywords = [
      serviceName.toLowerCase(),
      serviceName.replace(/([A-Z])/g, ' $1').trim().toLowerCase(),
    ];
    
    patterns.push({
      keywords,
      recommendedNode: nodeType,
      reason: `Use ${serviceName} node for integration`
    });
  }
  
  // Category 3: Generic Utilities
  patterns.push({
    keywords: ['webhook', 'trigger', 'receive', 'listen'],
    recommendedNode: 'n8n-nodes-base.webhook',
    reason: 'Webhook is the standard trigger for external events'
  });
  
  patterns.push({
    keywords: ['http', 'api', 'rest', 'request', 'call', 'fetch'],
    recommendedNode: 'n8n-nodes-base.httpRequest',
    reason: 'HTTP Request works for any API'
  });
  
  console.log(`[NODE-KNOWLEDGE] Generated ${patterns.length} node patterns from ${VALID_NODE_TYPES.length} nodes`);
  return patterns;
}

// Lazy-loaded patterns (generated on first access)
let CACHED_PATTERNS: NodePattern[] | null = null;

function getPatterns(): NodePattern[] {
  if (!CACHED_PATTERNS) {
    CACHED_PATTERNS = generateNodePatterns();
  }
  return CACHED_PATTERNS;
}

/**
 * Analyze user request and return relevant node recommendations
 */
export function getNodeRecommendations(userRequest: string): string {
  const requestLower = userRequest.toLowerCase();
  const matchedPatterns: NodePattern[] = [];
  const patterns = getPatterns(); // Use dynamic patterns
  
  // Find all matching patterns
  for (const pattern of patterns) {
    const matches = pattern.keywords.some(keyword => 
      requestLower.includes(keyword.toLowerCase())
    );
    
    if (matches) {
      matchedPatterns.push(pattern);
    }
  }
  
  if (matchedPatterns.length === 0) {
    return ''; // No specific recommendations
  }
  
  // Build recommendation text
  let recommendations = '\n## 🎯 Recommended Nodes for Your Request\n\n';
  
  for (const pattern of matchedPatterns) {
    recommendations += `### ${pattern.recommendedNode}\n`;
    recommendations += `**Why:** ${pattern.reason}\n\n`;
    
    if (pattern.exampleParams) {
      recommendations += '**Example parameters:**\n```json\n';
      recommendations += JSON.stringify(pattern.exampleParams, null, 2);
      recommendations += '\n```\n\n';
    }
    
    if (pattern.alternativeNode) {
      recommendations += `*Alternative (less reliable):* ${pattern.alternativeNode}\n\n`;
    }
  }
  
  return recommendations;
}

/**
 * Get safe vs risky service nodes
 * Social media nodes = risky (may not support all operations)
 * Well-established service nodes = safe
 */
export function categorizeServiceNode(nodeType: string): 'safe' | 'risky' | 'unknown' {
  const nodeLower = nodeType.toLowerCase();
  
  // Social media platforms (often have limited API access or incomplete n8n nodes)
  const socialMediaKeywords = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok', 'pinterest', 'reddit', 'youtube'];
  if (socialMediaKeywords.some(keyword => nodeLower.includes(keyword))) {
    return 'risky';
  }
  
  // Well-established integrations with full n8n support
  const establishedKeywords = ['slack', 'sheets', 'airtable', 'notion', 'trello', 'github', 'gitlab', 'jira', 'asana', 'stripe', 'paypal', 'shopify', 'mailchimp', 'sendgrid'];
  if (establishedKeywords.some(keyword => nodeLower.includes(keyword))) {
    return 'safe';
  }
  
  return 'unknown';
}

/**
 * Check if a node exists in our registry
 */
export function nodeExists(nodeType: string): boolean {
  return VALID_NODE_TYPES.includes(nodeType);
}

/**
 * Get alternative node for risky operations
 */
export function getAlternativeNode(nodeType: string, operation?: string): string | null {
  const category = categorizeServiceNode(nodeType);
  
  // If it's a risky node and involves writing/posting, suggest httpRequest
  if (category === 'risky' && operation) {
    const writeOps = ['post', 'create', 'upload', 'publish', 'send', 'update', 'delete'];
    if (writeOps.some(op => operation.toLowerCase().includes(op))) {
      return 'n8n-nodes-base.httpRequest';
    }
  }
  
  return null;
}
