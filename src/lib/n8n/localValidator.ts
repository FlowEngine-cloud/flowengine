import { z } from 'zod';
import * as _ from 'lodash';
import { isValidNodeType as isRealNodeType, suggestNodeType, findSimilarNodeInCategory } from './nodeRegistry';
import { isStartingNode } from './workflowConstants';
import { validateAIAgentWorkflow } from './aiAgentValidator';
import { detectNodeCategory, getCategoryNodes } from './nodeCategoryDetector';

export interface ValidationResult {
  isValid: boolean;
  valid: boolean;
  errors: string[];
  warnings: string[];
  fixes?: string[];
  autofixed?: boolean;
  normalized?: any;
  normalizedIncluded?: boolean;
}

// Zod schema for n8n workflow validation
const NodeSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  type: z.string().regex(/^n8n-nodes-base\.|^@n8n\/|^n8n-nodes-|^CUSTOM\.|^@tavily\//),  // Include CUSTOM. for FlowEngine nodes and @tavily/ for Tavily nodes
  typeVersion: z.number().positive().optional(),
  position: z.array(z.number()).length(2),
  parameters: z.record(z.any())
});

const ConnectionSchema = z.record(
  z.record(
    z.array(
      z.array(
        z.object({
          node: z.string(),
          type: z.string(),
          index: z.number()
        })
      )
    )
  )
);

const WorkflowSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  nodes: z.array(NodeSchema).min(1),
  connections: ConnectionSchema.optional(),
  active: z.boolean().optional(),
  settings: z.record(z.any()).optional(),
  notes: z.array(z.any()).optional(), // Preserve sticky notes/annotations
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

export function validateWithN8n(workflowJson: any, options?: { autofix?: boolean; strict?: boolean }): Promise<ValidationResult> {
  // strict defaults to true - catches AI-hallucinated fake nodes
  // Set strict: false for analyzer mode (user-submitted workflows may have valid nodes not in our registry)
  return Promise.resolve(validateWorkflow(workflowJson, options?.autofix, options?.strict ?? true));
}

// Helper function to generate descriptive node names
function generateDescriptiveName(node: any, index: number): string {
  const nodeType = node.type || '';

  // Map common node types to descriptive names
  if (nodeType.includes('manualTrigger')) return 'Manual Trigger';
  if (nodeType.includes('webhook')) return 'Webhook Trigger';
  if (nodeType.includes('schedule')) return 'Schedule Trigger';
  if (nodeType.includes('googleSheets')) return 'Google Sheets';
  if (nodeType.includes('gmail')) return 'Gmail';
  if (nodeType.includes('slack')) return 'Slack';
  if (nodeType.includes('http')) return 'HTTP Request';
  if (nodeType.includes('set')) return 'Set Data';
  if (nodeType.includes('code')) return 'Code Execute';
  if (nodeType.includes('if')) return 'Condition Check';
  if (nodeType.includes('function')) return 'Function';
  if (nodeType.includes('merge')) return 'Merge Data';
  if (nodeType.includes('split')) return 'Split Data';
  if (nodeType.includes('filter')) return 'Filter Data';
  if (nodeType.includes('transform')) return 'Transform Data';
  if (nodeType.includes('email')) return 'Send Email';
  if (nodeType.includes('file')) return 'File Operation';
  if (nodeType.includes('database')) return 'Database Query';

  // Extract meaningful part from node type
  const typeParts = nodeType.split('.');
  const baseType = typeParts[typeParts.length - 1] || 'Node';

  // Convert camelCase to Title Case
  return baseType.replace(/([A-Z])/g, ' $1').replace(/^./, (str: string) => str.toUpperCase()).trim() || `Process Step ${index + 1}`;
}

// Use strict validation from nodeRegistry for consistency
// Create wrapper that passes strict parameter
const isValidNodeType = (nodeType: string, strict: boolean = true) => isRealNodeType(nodeType, strict);

function validateWorkflow(workflowJson: any, autofix = true, strict = true): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: string[] = [];

  try {
    // Step 0: CRITICAL - Validate JSON structure first
    // Catch malformed/incomplete JSON before processing
    if (!workflowJson || typeof workflowJson !== 'object') {
      return { isValid: false, valid: false, errors: ['❌ CRITICAL: Invalid workflow format - not a valid JSON object'], warnings: [], fixes: [] };
    }

    // Check for incomplete node structures (missing closing braces, etc.)
    if (workflowJson.nodes && Array.isArray(workflowJson.nodes)) {
      for (let i = 0; i < workflowJson.nodes.length; i++) {
        const node = workflowJson.nodes[i];

        // Critical: Check if node is a valid object
        if (!node || typeof node !== 'object') {
          errors.push(`❌ CRITICAL: Node at index ${i} is not a valid object - workflow JSON is malformed`);
          return { isValid: false, valid: false, errors, warnings, fixes: [] };
        }

        // Critical: Check for incomplete parameters object
        if ('parameters' in node) {
          if (typeof node.parameters !== 'object' && node.parameters !== null) {
            if (!autofix) {
              errors.push(`❌ CRITICAL: Node "${node.name || `at index ${i}`}" has malformed parameters - expected object, got ${typeof node.parameters}`);
              return { isValid: false, valid: false, errors, warnings, fixes: [] };
            }
            // autofix will reset parameters below
            node.parameters = {};
          }

          // Check if parameters object is complete (has all required brackets)
          try {
            JSON.stringify(node.parameters);
          } catch (e) {
            errors.push(`❌ CRITICAL: Node "${node.name || `at index ${i}`}" has unparseable parameters - workflow JSON is incomplete`);
            return { isValid: false, valid: false, errors, warnings, fixes: [] };
          }
        }

        if (!autofix) {
          // Critical: Check for missing required node fields (strict mode only)
          if (!node.name) {
            errors.push(`❌ CRITICAL: Node at index ${i} is missing 'name' field - workflow JSON is incomplete`);
          }
          if (!node.type) {
            errors.push(`❌ CRITICAL: Node at index ${i} is missing 'type' field - workflow JSON is incomplete`);
          }
          if (!node.position || !Array.isArray(node.position)) {
            errors.push(`❌ CRITICAL: Node "${node.name || `at index ${i}`}" is missing 'position' field - workflow JSON is incomplete`);
          }
        }
      }

      // If we found critical errors, return immediately - no point in continuing
      if (errors.length > 0) {
        return {
          isValid: false,
          valid: false,
          errors: [
            '❌ WORKFLOW JSON IS MALFORMED/INCOMPLETE',
            'The workflow contains incomplete node definitions or missing required fields.',
            'This usually means the AI response was cut off or truncated.',
            '',
            'Specific errors:',
            ...errors
          ],
          warnings,
          fixes: []
        };
      }
    }

    // Step 1: Zod Schema Validation
    // When autofix is enabled, use a lenient schema that accepts any node type string
    // so that autofix logic downstream can replace invalid types with real ones.
    const LenientNodeSchema = z.object({
      id: z.any().optional(),
      name: z.any().optional(),
      type: z.any().optional(),
      typeVersion: z.any().optional(),
      position: z.any().optional(),
      parameters: z.any().optional()
    });
    const LenientWorkflowSchema = z.object({
      id: z.string().optional(),
      name: z.string().optional(),
      nodes: z.array(LenientNodeSchema),
      connections: z.any().optional(),
      active: z.boolean().optional(),
      settings: z.record(z.any()).optional(),
      notes: z.array(z.any()).optional(),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional()
    });

    const schemaToUse = autofix ? LenientWorkflowSchema : WorkflowSchema;
    const schemaValidation = schemaToUse.safeParse(workflowJson);
    if (!schemaValidation.success) {
      const schemaErrors = schemaValidation.error.errors.map(error =>
        `❌ ${error.path.join('.')}: ${error.message}`
      );

      return {
        isValid: false,
        valid: false,
        errors: [
          '❌ WORKFLOW FAILED STRICT VALIDATION',
          'The workflow does not meet n8n structure requirements.',
          '',
          ...schemaErrors
        ],
        warnings,
        fixes: []
      };
    }

    // When autofix is enabled, normalize missing node fields before proceeding
    if (autofix && workflowJson.nodes && Array.isArray(workflowJson.nodes)) {
      for (let i = 0; i < workflowJson.nodes.length; i++) {
        const node = workflowJson.nodes[i];
        if (!node.id) {
          node.id = `node-${i + 1}`;
          fixes.push(`Added missing id to node at index ${i}`);
        }
        if (!node.name) {
          node.name = generateDescriptiveName(node, i) || `Node ${i + 1}`;
          fixes.push(`Added missing name to node at index ${i}`);
        }
        if (!node.type) {
          node.type = 'n8n-nodes-base.manualTrigger';
          fixes.push(`Added default type to node at index ${i}`);
        }
        if (!node.typeVersion || typeof node.typeVersion !== 'number') {
          node.typeVersion = 1;
          fixes.push(`Added default typeVersion to node at index ${i}`);
        }
        if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
          node.position = [100 + i * 200, 100];
          fixes.push(`Added default position to node at index ${i}`);
        }
        if (!node.parameters || typeof node.parameters !== 'object') {
          node.parameters = {};
          fixes.push(`Added empty parameters to node at index ${i}`);
        }
      }
    }

    // Step 2: Basic structure validation
    if (!workflowJson.nodes || !Array.isArray(workflowJson.nodes)) {
      return { isValid: false, valid: false, errors: ['Workflow must have nodes array'], warnings: [], fixes: [] };
    }

    if (workflowJson.nodes.length === 0) {
      return { isValid: false, valid: false, errors: ['Workflow must have at least one node'], warnings: [], fixes: [] };
    }


    const allNodes = workflowJson.nodes;
    const nodeNames = new Set(allNodes.map((n: any) => n.name));

    // Check for duplicate node names (skip in autofix mode — applySafeFixes renames them)
    if (nodeNames.size !== allNodes.length && !autofix) {
      errors.push('Workflow contains nodes with duplicate names');
    }

    // Validate each node
    for (const node of allNodes) {
      const nodeName = (node as any).name;
      const nodeType = (node as any).type;

      // Check node has required properties
      if (!nodeName) {
        errors.push('Node missing name');
        continue;
      }

      if (!nodeType) {
        errors.push(`Node "${nodeName}" missing type`);
        continue;
      }

      // Validate node type format (should be n8n-nodes-base.* or similar)
      // Skip this check in autofix mode — invalid types will be replaced downstream
      if (!nodeType.includes('.') && !autofix) {
        errors.push(`Node "${nodeName}" has invalid type format "${nodeType}" (expected format: package.nodeName)`);
      }

      // Check if node type is real/valid
      // Use the strict parameter and skip error if autofix is enabled (node will be fixed later)
      if (!isValidNodeType(nodeType, strict) && !autofix) {
        const suggestion = suggestNodeType(nodeName + ' ' + nodeType);
        errors.push(`Node "${nodeName}" uses unknown type "${nodeType}" - should use "${suggestion}" instead`);
      }

      // id and typeVersion are optional - n8n will generate/use defaults

      if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
        if (!autofix) {
          errors.push(`Node "${nodeName}" missing or invalid position array`);
        }
      }

      if (typeof node.parameters !== 'object') {
        errors.push(`Node "${nodeName}" missing parameters object`);
      } else {
        // Validate node-specific required parameters
        const nodeTypeSimple = nodeType.split('.').pop()?.toLowerCase() || '';

        // NO hardcoded parameter validation
        // n8n versions have different parameter requirements
        // Users will configure parameters in n8n after import
      }

      // Validate credential structure if present
      if (node.credentials) {
        if (typeof node.credentials !== 'object') {
          errors.push(`Node "${nodeName}" has invalid credentials format (must be an object)`);
        } else {
          // Known correct credential types for common nodes
          const correctCredentials: Record<string, string> = {
            'googlesheets': 'googleSheetsOAuth2Api',
            'gmail': 'gmailOAuth2',
            'slack': 'slackOAuth2Api',
            'github': 'githubOAuth2Api',
            'notion': 'notionOAuth2Api',
            'airtable': 'airtableOAuth2Api'
          };

          // Check each credential has proper structure (but don't fail on format issues - autofix will handle it)
          for (const [credType, credValue] of Object.entries(node.credentials)) {
            if (!credValue || typeof credValue !== 'object') {
              errors.push(`Node "${nodeName}" credential "${credType}" has invalid format`);
            } else {
              const cred = credValue as any;
              // Accept any credential ID format - n8n will validate on import
            }
          }
        }
      }
    }

    // Step 3: Enhanced n8n workflow structure validation using real node registry
    try {
      // Validate workflow structure without mock data
      const hasValidStructure = workflowJson.nodes && Array.isArray(workflowJson.nodes) && workflowJson.nodes.length > 0;
      const hasValidConnections = !workflowJson.connections || typeof workflowJson.connections === 'object';

      if (hasValidStructure && hasValidConnections) {
        console.log('✅ N8N workflow structure validated with real node types');
      } else {
        // Don't add structure warnings for auto-fixed workflows - they're informational only
        if (!autofix) {
          warnings.push('Workflow structure validation: Invalid basic structure');
        }
      }
    } catch (workflowError: any) {
      // Don't add structure error warnings for auto-fixed workflows
      if (!autofix) {
        warnings.push(`N8N structure validation: ${workflowError.message}`);
      }
      console.warn('⚠️ N8N structure validation failed:', workflowError.message);
    }


    // Validate node names are descriptive (not generic)
    // Skip in autofix mode — applySafeFixes will rename generic names downstream
    if (!autofix) {
      for (const node of allNodes) {
        const nodeName = (node as any).name;
        if (nodeName && /^(Node|node)\d+$/i.test(nodeName)) {
          errors.push(`Node "${nodeName}" has generic name - use descriptive names like "Google Sheets Read", "Process Data", etc.`);
        }
      }
    }


    // CRITICAL: Validate connection names match node names FIRST
    const connectionNameErrors = validateConnectionNames(workflowJson);
    if (connectionNameErrors.length > 0) {
      errors.push(...connectionNameErrors);
    }

    // Connection validation - validate structure and orphaned nodes
    // NOTE: Multiple disconnected workflows are NORMAL in n8n, so we don't warn about that
    if (workflowJson.connections && Object.keys(workflowJson.connections).length > 0) {
      const connectionValidation = validateNodeConnections(workflowJson.nodes, workflowJson.connections);
      errors.push(...connectionValidation.errors);
      // Only critical warnings: connection errors and orphaned non-trigger nodes
      const criticalWarnings = connectionValidation.warnings.filter((warning: string) =>
        warning.includes('Connection references non-existent') ||
        warning.includes('Invalid connection') ||
        warning.includes('is not connected to the workflow') // Orphaned nodes
      );
      warnings.push(...criticalWarnings);
    }

    // Validate workflow metadata
    if (workflowJson.name && typeof workflowJson.name !== 'string') {
      errors.push('Workflow name must be a string');
    }

    if (workflowJson.active !== undefined && typeof workflowJson.active !== 'boolean') {
      errors.push('Workflow active flag must be a boolean');
    }

    const isValid = errors.length === 0;

    let workflowToValidate = workflowJson;
    let autofixed = false;

    // ALWAYS run AI Agent validation (critical for pattern enforcement)
    const aiAgentValidation = validateAIAgentWorkflow(workflowJson, { autofix });
    errors.push(...aiAgentValidation.errors);
    warnings.push(...aiAgentValidation.warnings);

    if (aiAgentValidation.autofixed && autofix) {
      workflowToValidate = aiAgentValidation.workflow;
      fixes.push(...aiAgentValidation.fixes);
      autofixed = true;
    }

    // Run general fixes only when autofix enabled
    if (autofix) {

      // Step 2: General workflow fixes (but DON'T override AI agent fixes!)
      // Pass the already-fixed workflow to avoid re-breaking it
      const fixResult = applySafeFixes(workflowToValidate);
      if (fixResult.fixed) {
        // Merge general fixes but preserve AI agent changes
        warnings.push(...fixResult.warnings.filter(w => !w.includes('Chat Memory')));
        fixes.push(...fixResult.fixes.filter(f =>
          !f.includes('Chat Memory') &&
          !f.includes('OpenAI') &&
          !f.includes('invalid node type') &&
          !f.toLowerCase().includes('langchain')
        ));

        // Apply fixes from general validator while preserving AI agent (langchain) nodes
        // Use the fixed workflow's nodes directly — applySafeFixes handles name dedup,
        // missing fields, and position fixes that we need to propagate
        const isLangchainNode = (type: string) => type && type.includes('langchain');
        for (let i = 0; i < workflowToValidate.nodes.length; i++) {
          const node = workflowToValidate.nodes[i];
          const fixedNode = fixResult.workflow.nodes.find((n: any) => n.id === node.id);
          if (fixedNode) {
            // Propagate name fixes (e.g., duplicate name resolution) for non-langchain nodes
            if (fixedNode.name && !isLangchainNode(node.type)) {
              node.name = fixedNode.name;
            }
            if (fixedNode.position && !isLangchainNode(node.type)) {
              node.position = fixedNode.position;
            }
            if (fixedNode.parameters && Object.keys(fixedNode.parameters).length > Object.keys(node.parameters || {}).length) {
              node.parameters = { ...node.parameters, ...fixedNode.parameters };
            }
          }
        }

        autofixed = true;
      }
    }

    // Using function defined above to avoid strict mode issues

    // CRITICAL FIX #4: Comprehensive Fake Node Detection & Conversion
    // Uses node registry validation to detect ALL fake/non-existent nodes
    //
    // strict=true (default): Only accept nodes in registry - catches AI-hallucinated fake nodes
    // strict=false (analyzer): Also accept pattern matches for user-submitted workflows

    for (const node of workflowToValidate.nodes || []) {
      const nodeType = node.type;
      const nodeName = node.name || 'unnamed';

      // Check validity using the strict parameter passed to validateWorkflow
      // In strict mode: node must exist in registry (no pattern matching fallback)
      // In lenient mode: accepts nodes following n8n naming conventions
      const isExactlyValid = isValidNodeType(nodeType, strict);

      if (!isExactlyValid) {
        // Node is fake/invalid - try to find valid alternative
        const suggestion = suggestNodeType(nodeName + ' ' + nodeType);

        if (autofix) {
          // CATEGORY-AWARE CONVERSION: Detect node category from connections, then find similar node in same category
          // (detectNodeCategory, getCategoryNodes, findSimilarNodeInCategory imported at top)

          // Detect what category this node belongs to based on its connections
          const nodeCategory = detectNodeCategory(workflowToValidate, nodeName);
          const categoryKey = getCategoryNodes(nodeCategory);

          console.log(`[localValidator] Node "${nodeName}" detected as category: ${nodeCategory} (${categoryKey})`);

          // Try 1: Find similar node in same category using dynamic search
          const similarNode = findSimilarNodeInCategory(nodeType, categoryKey);

          // Note: When checking replacement nodes, always use strict=true
          // We want to ensure we're replacing with REAL nodes from our registry
          if (similarNode && isValidNodeType(similarNode, true)) {
            // Found similar node in same category - use it!
            node.type = similarNode;
            fixes.push(
              `🔄 Converted "${nodeName}": ${nodeType} → ${similarNode} (similar ${nodeCategory} node)`
            );
            autofixed = true;
          } else if (suggestion && suggestion !== nodeType && isValidNodeType(suggestion, true)) {
            // Try 2: Use old suggestion system as fallback
            node.type = suggestion;
            fixes.push(`🔄 Converted fake node "${nodeName}" from "${nodeType}" → "${suggestion}"`);
            autofixed = true;
          } else {
            // Try 3: No similar node found - use category-appropriate HTTP fallback
            if (nodeCategory === 'aiTool') {
              // AI Tool category → use toolHttpRequest (TOOL)
              node.type = '@n8n/n8n-nodes-langchain.toolHttpRequest';
              if (!node.parameters) node.parameters = {};
              node.parameters.options = {};
              fixes.push(
                `🔄 Converted invalid AI tool "${nodeName}" (was: ${nodeType}) → toolHttpRequest (TOOL category). ` +
                `Configure in n8n.`
              );
              autofixed = true;
            } else {
              // Regular/Trigger/Unknown category → use httpRequest (BASE)
              node.type = 'n8n-nodes-base.httpRequest';
              if (!node.parameters) node.parameters = {};
              node.parameters.options = {
                ...node.parameters.options,
                retry: {
                  retryOnFail: true,
                  maxTries: 3,
                  waitBetweenTries: 5000
                }
              };
              fixes.push(
                `🔄 Converted invalid node "${nodeName}" (was: ${nodeType}) → httpRequest (BASE category). ` +
                `Configure API endpoint in n8n.`
              );
              autofixed = true;
            }
          }
        } else{
          // No autofix - just report error
          errors.push(
            `INVALID NODE TYPE: "${nodeType}" in node "${nodeName}" does not exist in registry. ` +
            (suggestion ? `Suggestion: "${suggestion}"` : 'No valid alternative found.')
          );
        }
      }
    }

    // Relaxed trigger validation - look for trigger patterns
    const hasTrigger = workflowToValidate.nodes?.some((node: any) => {
      const nodeType = node.type || '';
      return nodeType.includes('Trigger') ||
             nodeType.includes('trigger') ||
             nodeType.includes('manual') ||
             nodeType.includes('webhook') ||
             nodeType.includes('schedule') ||
             nodeType.includes('cron');
    });

    // Only add trigger warning for workflows with many nodes (5+)
    // Most AI-generated workflows are valid even without explicit triggers
    if (!hasTrigger && workflowToValidate.nodes?.length > 5) {
      errors.push('WORKFLOW STRUCTURE INFO: Consider adding a trigger node for automatic execution.');
    }

    // Additional validation for workflow structure integrity
    try {
      // Validate that workflow has proper JSON structure for n8n
      if (workflowToValidate.meta && typeof workflowToValidate.meta !== 'object') {
        errors.push('Workflow meta must be an object');
      }

      if (workflowToValidate.tags && !Array.isArray(workflowToValidate.tags)) {
        errors.push('Workflow tags must be an array');
      }

      // typeVersion is optional - n8n will use latest version if not specified
    } catch (validationError: any) {
      errors.push(`Workflow structure validation failed: ${validationError.message}`);
    }

    const finalIsValid = errors.length === 0;

    if (autofixed) {
      return {
        isValid: finalIsValid,
        valid: finalIsValid,
        errors,
        warnings,
        fixes,
        autofixed: true,
        normalized: workflowToValidate,
        normalizedIncluded: true
      };
    }

    // Always include normalized workflow (even if no autofix was needed)
    return {
      isValid: finalIsValid,
      valid: finalIsValid,
      errors,
      warnings,
      fixes: [],
      normalized: workflowJson, // Include original workflow for UI
      normalizedIncluded: true
    };

  } catch (error: any) {
    return {
      isValid: false,
      valid: false,
      errors: [error.message || 'Unknown validation error'],
      warnings: [],
      fixes: []
    };
  }
}

/**
 * Apply safe fixes to a workflow to repair common issues
 */
function applySafeFixes(workflowJson: any): { fixed: boolean; workflow: any; warnings: string[]; fixes: string[] } {
  const warnings: string[] = [];
  const fixes: string[] = [];
  let fixed = false;

  // Create a deep copy to avoid mutating the original
  const workflow = JSON.parse(JSON.stringify(workflowJson));

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    return { fixed: false, workflow, warnings, fixes: [] };
  }

  // Fix missing workflow name
  if (!workflow.name || typeof workflow.name !== 'string') {
    workflow.name = 'My Workflow';
    fixes.push('Added missing workflow name');
    fixed = true;
  }

  // Ensure connections object exists
  if (!workflow.connections || typeof workflow.connections !== 'object') {
    workflow.connections = {};
    fixes.push('Added missing connections object');
    fixed = true;
  }

  // Track node names to detect duplicates
  const nodeNames = new Set<string>();
  const nodeNameCounts = new Map<string, number>();

  // First pass: count node names
  for (const node of workflow.nodes) {
    if (node.name) {
      const count = nodeNameCounts.get(node.name) || 0;
      nodeNameCounts.set(node.name, count + 1);
    }
  }

  // Function defined above file scope to avoid strict mode issues

  // Second pass: fix nodes
  for (let i = 0; i < workflow.nodes.length; i++) {
    const node = workflow.nodes[i];

    // Fix missing node type first
    if (!node.type) {
      node.type = 'n8n-nodes-base.httpRequest'; // Default fallback
      fixes.push(`Added missing node type for node "${node.name || 'unnamed'}"`);
      fixed = true;
    }

    // Fix invalid node type format (missing dot)
    if (node.type && !node.type.includes('.')) {
      const oldType = node.type;
      node.type = `n8n-nodes-base.${oldType}`;
      fixes.push(`Fixed node type format: "${oldType}" → "${node.type}" for node "${node.name || 'unnamed'}"`);
      fixed = true;
    }

    // Fix invalid node types
    if (node.type && !isRealNodeType(node.type)) {
      const oldType = node.type;
      const suggestedType = suggestNodeType(node.name + ' ' + node.type);
      node.type = suggestedType;
      fixes.push(`Fixed invalid node type: "${oldType}" → "${suggestedType}" for node "${node.name || 'unnamed'}"`);
      fixed = true;
    }

    // Fix missing or duplicate node names
    if (!node.name || nodeNameCounts.get(node.name)! > 1 || /^(Node|node)\d+$/i.test(node.name)) {
      const descriptiveName = generateDescriptiveName(node, i);
      let uniqueName = descriptiveName;
      let counter = 1;

      while (nodeNames.has(uniqueName)) {
        counter++;
        uniqueName = `${descriptiveName} ${counter}`;
      }

      const oldName = node.name;
      node.name = uniqueName;
      if (!oldName) {
        fixes.push(`Added missing name for node: "${uniqueName}"`);
      } else {
        fixes.push(`Renamed "${oldName}" to descriptive name "${uniqueName}"`);
      }
      fixed = true;
    }

    nodeNames.add(node.name);

    // id and typeVersion are optional - n8n will generate/use defaults if not provided

    // Fix missing or invalid position
    if (!node.position || !Array.isArray(node.position) || node.position.length !== 2) {
      node.position = [100 + (i * 200), 100];
      fixes.push(`Set default position for node "${node.name}"`);
      fixed = true;
    }

    // Fix missing parameters
    if (typeof node.parameters !== 'object' || node.parameters === null) {
      node.parameters = {};
      fixes.push(`Added empty parameters object for node "${node.name}"`);
      fixed = true;
    }

    // Add placeholder credentials for nodes that require them
    const nodeTypeSimple = node.type.split('.').pop()?.toLowerCase() || '';
    const credentialMappings: Record<string, { type: string, name: string }> = {
      'googlesheets': { type: 'googleSheetsOAuth2Api', name: 'Google Sheets account' },
      'gmail': { type: 'gmailOAuth2', name: 'Gmail account' },
      'slack': { type: 'slackOAuth2Api', name: 'Slack account' },
      'discord': { type: 'discordOAuth2Api', name: 'Discord account' },
      'notion': { type: 'notionOAuth2Api', name: 'Notion account' },
      'airtable': { type: 'airtableOAuth2Api', name: 'Airtable account' },
      'github': { type: 'githubOAuth2Api', name: 'GitHub account' },
      'gitlab': { type: 'gitlabOAuth2Api', name: 'GitLab account' },
      'shopify': { type: 'shopifyOAuth2Api', name: 'Shopify account' },
      'stripe': { type: 'stripeApi', name: 'Stripe account' },
      'hubspot': { type: 'hubspotOAuth2Api', name: 'HubSpot account' },
      'googledrive': { type: 'googleDriveOAuth2Api', name: 'Google Drive account' },
      'dropbox': { type: 'dropboxOAuth2Api', name: 'Dropbox account' },
      'postgres': { type: 'postgres', name: 'PostgreSQL account' },
      'mysql': { type: 'mySql', name: 'MySQL account' },
      'mongodb': { type: 'mongoDb', name: 'MongoDB account' },
      'redis': { type: 'redis', name: 'Redis account' },
      'ssh': { type: 'sshPassword', name: 'SSH account' },
      'ftp': { type: 'ftp', name: 'FTP account' }
    };

    // Fix credentials
    let credentialFixed = false;
    for (const [nodeKeyword, credInfo] of Object.entries(credentialMappings)) {
      if (nodeTypeSimple.includes(nodeKeyword)) {
        if (!node.credentials) {
          // Add missing credentials
          node.credentials = {
            [credInfo.type]: {
              id: `placeholder-${nodeKeyword}-${i}`,
              name: credInfo.name
            }
          };
          fixes.push(`Added placeholder credentials for node "${node.name}"`);
          fixed = true;
          credentialFixed = true;
        } else {
          // Fix wrong credential type
          const currentCredType = Object.keys(node.credentials)[0];
          if (currentCredType && currentCredType !== credInfo.type) {
            const oldCredValue = node.credentials[currentCredType];
            delete node.credentials[currentCredType];
            node.credentials[credInfo.type] = oldCredValue;
            fixes.push(`Fixed credential type for node "${node.name}": "${currentCredType}" → "${credInfo.type}"`);
            fixed = true;
            credentialFixed = true;
          }

          // Fix credential ID format if it's not numeric or placeholder
          const credValue = node.credentials[credInfo.type] || node.credentials[currentCredType];
          if (credValue && credValue.id) {
            if (!credValue.id.toString().match(/^\d+$/) && !credValue.id.toString().startsWith('placeholder-')) {
              credValue.id = `placeholder-${nodeKeyword}-${i}`;
              fixes.push(`Fixed credential ID for node "${node.name}" to placeholder format`);
              fixed = true;
            }
          }
        }
        if (credentialFixed) break;
      }
    }

    // Fix empty string parameters - replace with placeholders
    for (const [key, value] of Object.entries(node.parameters || {})) {
      if (value === '') {
        (node.parameters as any)[key] = `placeholder-${key}`;
        fixes.push(`Replaced empty "${key}" parameter with placeholder in node "${node.name}"`);
        fixed = true;
      }
    }

    // NO hardcoded parameter fixes - let n8n validate on import
    // Users will configure missing parameters in n8n UI
  }

  // Intelligent connection analysis - only suggest connections for obvious cases
  if (workflow.nodes.length > 1 && (!workflow.connections || Object.keys(workflow.connections).length === 0)) {
    const triggerNodes = workflow.nodes.filter((node: any) => {
      const nodeType = (node.type || '').toLowerCase();
      return nodeType.includes('trigger') || nodeType.includes('webhook') ||
             nodeType.includes('schedule') || nodeType.includes('manual');
    });

    const actionNodes = workflow.nodes.filter((node: any) => {
      const nodeType = (node.type || '').toLowerCase();
      return !nodeType.includes('trigger') && !nodeType.includes('webhook') &&
             !nodeType.includes('schedule') && !nodeType.includes('manual');
    });

    // Auto-connect workflows with proper sequential flow
    if (triggerNodes.length === 1 && actionNodes.length === 1) {
      // Simple case: 1 trigger + 1 action
      workflow.connections = {};
      workflow.connections[triggerNodes[0].name] = {
        main: [
          [
            {
              node: actionNodes[0].name,
              type: 'main',
              index: 0
            }
          ]
        ]
      };
      fixes.push(`Connected trigger "${triggerNodes[0].name}" to action "${actionNodes[0].name}"`);
      fixed = true;
    } else if (triggerNodes.length > 0 && actionNodes.length > 0) {
      // Complex case: Create linear flow (trigger → action1 → action2 → ...)
      workflow.connections = {};
      const flow = [triggerNodes[0], ...actionNodes];

      for (let i = 0; i < flow.length - 1; i++) {
        workflow.connections[flow[i].name] = {
          main: [
            [
              {
                node: flow[i + 1].name,
                type: 'main',
                index: 0
              }
            ]
          ]
        };
      }

      const flowDescription = flow.map(n => n.name).join(' → ');
      fixes.push(`Created sequential connections: ${flowDescription}`);
      fixed = true;
    } else {
      // No triggers or no actions - just note it
      fixes.push(`Workflow has ${workflow.nodes.length} nodes but no clear trigger-action pattern for auto-connection`);
    }
  }

  // Fix invalid connections (remove connections to non-existent nodes)
  if (workflow.connections) {
    const validNodeNames = new Set(workflow.nodes.map((n: any) => n.name));

    for (const [sourceNode, connections] of Object.entries(workflow.connections)) {
      if (!validNodeNames.has(sourceNode)) {
        delete workflow.connections[sourceNode];
        fixes.push(`Removed connections from non-existent source node "${sourceNode}"`);
        fixed = true;
        continue;
      }

      for (const [, outputs] of Object.entries(connections as any)) {
        if (!Array.isArray(outputs)) continue;

        for (let i = 0; i < outputs.length; i++) {
          const outputConnections = outputs[i];
          if (!Array.isArray(outputConnections)) continue;

          // Filter out connections to non-existent nodes
          const validConnections = outputConnections.filter((conn: any) => {
            if (!conn.node || !validNodeNames.has(conn.node)) {
              fixes.push(`Removed connection from "${sourceNode}" to non-existent node "${conn.node}"`);
              fixed = true;
              return false;
            }
            return true;
          });

          outputs[i] = validConnections;
        }
      }
    }
  }

  return { fixed, workflow, warnings, fixes };
}

/**
 * Validate that all connection node names match actual node names
 * CRITICAL: This catches the most common AI error
 */
function validateConnectionNames(workflow: any): string[] {
  const errors: string[] = [];

  if (!workflow.nodes || !workflow.connections) {
    return errors;
  }

  const nodeNames = new Set(workflow.nodes.map((n: any) => n.name));

  for (const [sourceName, connections] of Object.entries(workflow.connections || {})) {
    // Check source node exists
    if (!nodeNames.has(sourceName)) {
      errors.push(`❌ CRITICAL: Connection source "${sourceName}" does not match any node name`);
    }

    // Check all target nodes exist
    if (typeof connections === 'object' && connections !== null) {
      for (const [connType, outputs] of Object.entries(connections as any)) {
        if (Array.isArray(outputs)) {
          for (const outputArray of outputs) {
            if (Array.isArray(outputArray)) {
              for (const conn of outputArray) {
                if (conn && typeof conn === 'object' && 'node' in conn) {
                  if (!nodeNames.has(conn.node)) {
                    errors.push(`❌ CRITICAL: Connection target "${conn.node}" does not match any node name (from "${sourceName}" via "${connType}")`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  return errors;
}

/**
 * Validate node connections and workflow graph structure
 */
function validateNodeConnections(nodes: any[], connections: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!connections || typeof connections !== 'object') {
    return { errors, warnings };
  }

  const nodeNames = new Set(nodes.map(n => n.name));

  // Validate connection structure and references
  for (const [sourceNode, nodeConnections] of Object.entries(connections)) {
    // Check if source node exists
    if (!nodeNames.has(sourceNode)) {
      errors.push(`Connection references non-existent source node: "${sourceNode}"`);
      continue;
    }

    if (typeof nodeConnections !== 'object' || !nodeConnections) {
      errors.push(`Invalid connection structure for node: "${sourceNode}"`);
      continue;
    }

    // Validate output connections
    for (const [outputType, outputs] of Object.entries(nodeConnections as any)) {
      if (!Array.isArray(outputs)) {
        errors.push(`Invalid output type "${outputType}" for node "${sourceNode}" - should be array`);
        continue;
      }

      for (let outputIndex = 0; outputIndex < outputs.length; outputIndex++) {
        const outputConnections = outputs[outputIndex];

        if (!Array.isArray(outputConnections)) {
          errors.push(`Invalid output connections at index ${outputIndex} for node "${sourceNode}"`);
          continue;
        }

        // Validate each connection in this output
        for (const connection of outputConnections) {
          if (typeof connection !== 'object' || !connection) {
            errors.push(`Invalid connection object in node "${sourceNode}" output ${outputIndex}`);
            continue;
          }

          const { node: targetNode, type, index } = connection;

          // Check target node exists
          if (!targetNode || !nodeNames.has(targetNode)) {
            errors.push(`Connection from "${sourceNode}" references non-existent target node: "${targetNode}"`);
            continue;
          }

          // Check connection type
          if (typeof type !== 'string') {
            errors.push(`Invalid connection type from "${sourceNode}" to "${targetNode}"`);
          }

          // Check connection index
          if (typeof index !== 'number' || index < 0) {
            errors.push(`Invalid connection index from "${sourceNode}" to "${targetNode}": ${index}`);
          }

          // Prevent self-connections
          if (sourceNode === targetNode) {
            warnings.push(`Node "${sourceNode}" has a connection to itself`);
          }
        }
      }
    }
  }

  // Analyze workflow connectivity
  const connectedNodes = new Set<string>();
  const nodeConnections = new Map<string, Set<string>>();

  // Build connection graph
  for (const [sourceNode, nodeConns] of Object.entries(connections)) {
    connectedNodes.add(sourceNode);

    if (!nodeConnections.has(sourceNode)) {
      nodeConnections.set(sourceNode, new Set());
    }

    for (const outputs of Object.values(nodeConns as any)) {
      if (!Array.isArray(outputs)) continue;

      for (const outputConnections of outputs) {
        if (!Array.isArray(outputConnections)) continue;

        for (const connection of outputConnections) {
          if (connection.node) {
            connectedNodes.add(connection.node);
            nodeConnections.get(sourceNode)!.add(connection.node);

            if (!nodeConnections.has(connection.node)) {
              nodeConnections.set(connection.node, new Set());
            }
          }
        }
      }
    }
  }

  // Check for isolated components
  const visited = new Set<string>();
  const components: string[][] = [];

  function dfs(node: string, component: string[]) {
    if (visited.has(node)) return;
    visited.add(node);
    component.push(node);

    const connections = nodeConnections.get(node);
    if (connections) {
      Array.from(connections).forEach(connectedNode => {
        dfs(connectedNode, component);
      });
    }

    // Also check reverse connections
    Array.from(nodeConnections.entries()).forEach(([otherNode, otherConnections]) => {
      if (otherConnections.has(node)) {
        dfs(otherNode, component);
      }
    });
  }

  Array.from(connectedNodes).forEach(node => {
    if (!visited.has(node)) {
      const component: string[] = [];
      dfs(node, component);
      if (component.length > 0) {
        components.push(component);
      }
    }
  });

  // Check for disconnected components
  // NOTE: Multiple disconnected workflows in one file is NORMAL in n8n
  // (e.g., Error Trigger workflows, multiple trigger patterns)
  // So we don't warn about this - it's by design
  if (components.length > 1) {
    // Just log for debugging, don't warn users
    // warnings.push(`Workflow has ${components.length} disconnected components`);
  }

  // CRITICAL FIX #5: Zero Tolerance for Hanging Nodes
  // Every node MUST be connected (as source OR target), except sticky notes
  const unconnectedNodes = nodes.filter(node => !connectedNodes.has(node.name));
  if (unconnectedNodes.length > 0) {
    for (const node of unconnectedNodes) {
      const nodeType = node.type || '';
      const nodeName = node.name;

      // Skip sticky notes - they don't need connections
      if (nodeType === 'n8n-nodes-base.stickyNote') {
        continue;
      }

      // Use official n8n isStartingNode check for triggers
      const isTriggerType = isStartingNode(nodeType);

      if (isTriggerType) {
        errors.push(
          `❌ HANGING TRIGGER: "${nodeName}" is not connected - workflow can't start. ` +
          `Connect this trigger to the first action node.`
        );
      } else if (nodeType.endsWith('Tool')) {
        errors.push(
          `❌ HANGING TOOL: "${nodeName}" is not connected via ai_tool to any agent. ` +
          `Connect this tool to an AI agent.`
        );
      } else if (nodeType.includes('lmChat')) {
        errors.push(
          `❌ HANGING LLM: "${nodeName}" is not connected via ai_languageModel to any agent. ` +
          `Connect this model to an AI agent.`
        );
      } else if (nodeType.includes('memory')) {
        errors.push(
          `❌ HANGING MEMORY: "${nodeName}" is not connected via ai_memory to any agent. ` +
          `Connect this memory to an AI agent.`
        );
      } else {
        errors.push(
          `❌ HANGING NODE: "${nodeName}" is not connected to workflow. ` +
          `Every node must have at least one connection.`
        );
      }
    }
  }

  return { errors, warnings };
}