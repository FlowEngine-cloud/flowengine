/**
 * Node Validation and Auto-Correction System
 * Validates node types and suggests corrections for invalid nodes
 */

import { ALL_NODES as VALID_NODE_TYPES } from './nodeCategories.generated';

export interface ValidationResult {
  isValid: boolean;
  nodeType: string;
  suggestions?: string[];
  correctedNodeType?: string;
  confidence?: number;
}

/**
 * Validate a node type and provide correction suggestions
 */
export function validateNodeType(nodeType: string): ValidationResult {
  // Check if node type is valid
  if (VALID_NODE_TYPES.includes(nodeType)) {
    return {
      isValid: true,
      nodeType
    };
  }

  // Node type is invalid - try to find corrections
  const suggestions = findCorrections(nodeType);

  if (suggestions.length === 0) {
    return {
      isValid: false,
      nodeType,
      suggestions: []
    };
  }

  // Return best match with confidence score
  return {
    isValid: false,
    nodeType,
    suggestions: suggestions.map(s => s.nodeType),
    correctedNodeType: suggestions[0].nodeType,
    confidence: suggestions[0].confidence
  };
}

/**
 * Find correction suggestions for invalid node type
 */
function findCorrections(nodeType: string): Array<{ nodeType: string; confidence: number }> {
  // Extract the service name from the node type
  // e.g., "n8n-nodes-base.slack" -> "slack"
  const parts = nodeType.split('.');
  const serviceName = parts[parts.length - 1].toLowerCase();

  // Search for nodes matching this service name using fuzzy matching
  const matches: Array<{ nodeType: string; confidence: number }> = [];
  
  for (const validType of VALID_NODE_TYPES) {
    const validParts = validType.split('.');
    const validName = validParts[validParts.length - 1].toLowerCase();
    
    // Exact match
    if (validName === serviceName) {
      matches.push({ nodeType: validType, confidence: 1.0 });
      continue;
    }
    
    // Contains match
    if (validName.includes(serviceName) || serviceName.includes(validName)) {
      const confidence = Math.max(
        serviceName.length / validName.length,
        validName.length / serviceName.length
      ) * 0.8;
      matches.push({ nodeType: validType, confidence });
      continue;
    }
    
    // Levenshtein distance for typos
    const distance = levenshteinDistance(serviceName, validName);
    if (distance <= 3) {
      const confidence = 1 - (distance / Math.max(serviceName.length, validName.length));
      if (confidence > 0.6) {
        matches.push({ nodeType: validType, confidence: confidence * 0.9 });
      }
    }
  }
  
  // Sort by confidence and return top 5
  return matches
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Batch validate multiple node types
 */
export function validateNodeTypes(nodeTypes: string[]): Map<string, ValidationResult> {
  const results = new Map<string, ValidationResult>();

  for (const nodeType of nodeTypes) {
    results.set(nodeType, validateNodeType(nodeType));
  }

  return results;
}

/**
 * Auto-correct a node type if confidence is high enough
 * OR replace uncertain service nodes with httpRequest
 */
export function autoCorrectNodeType(
  nodeType: string,
  minConfidence: number = 0.9,
  nodeContext?: { operation?: string; service?: string }
): string {
  const validation = validateNodeType(nodeType);

  if (validation.isValid) {
    // Node exists, but check if it's a risky service node
    const riskyServices = ['facebook', 'instagram', 'twitter', 'linkedin', 'tiktok'];
    const isRiskyService = riskyServices.some(svc => nodeType.toLowerCase().includes(svc));
    
    if (isRiskyService && nodeContext?.operation) {
      const writeOperations = ['post', 'create', 'upload', 'publish', 'send'];
      const isWriteOp = writeOperations.some(op => nodeContext.operation?.toLowerCase().includes(op));
      
      if (isWriteOp) {
        console.log(`[NODE-VALIDATOR] Replacing risky service node "${nodeType}" with httpRequest for ${nodeContext.operation}`);
        return 'n8n-nodes-base.httpRequest';
      }
    }
    
    return nodeType;
  }

  if (
    validation.correctedNodeType &&
    validation.confidence !== undefined &&
    validation.confidence >= minConfidence
  ) {
    return validation.correctedNodeType;
  }

  // Return original if no high-confidence correction found
  return nodeType;
}

/**
 * Get all invalid nodes from a list with suggestions
 */
export function getInvalidNodes(nodeTypes: string[]): Array<{
  original: string;
  suggestions: string[];
}> {
  const invalid: Array<{ original: string; suggestions: string[] }> = [];

  for (const nodeType of nodeTypes) {
    const validation = validateNodeType(nodeType);
    if (!validation.isValid) {
      invalid.push({
        original: nodeType,
        suggestions: validation.suggestions || []
      });
    }
  }

  return invalid;
}

/**
 * Format validation result for display
 */
export function formatValidationResult(validation: ValidationResult): string {
  if (validation.isValid) {
    return `✓ Valid: ${validation.nodeType}`;
  }

  if (!validation.suggestions || validation.suggestions.length === 0) {
    return `✗ Invalid: ${validation.nodeType} (no suggestions found)`;
  }

  const confidence = validation.confidence
    ? ` (${(validation.confidence * 100).toFixed(0)}% confidence)`
    : '';

  return `✗ Invalid: ${validation.nodeType}
  → Suggested: ${validation.correctedNodeType}${confidence}
  → Other options: ${validation.suggestions.slice(1).join(', ') || 'none'}`;
}
