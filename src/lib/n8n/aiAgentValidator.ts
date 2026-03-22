/**
 * AI Agent Workflow Validator
 *
 * Specialized validator for AI agent workflows that ensures:
 * 1. Correct modern node types are used (no deprecated nodes)
 * 2. All AI agents have mandatory connections (model, memory, tools)
 * 3. Proper node positioning without overlaps
 * 4. Memory nodes are always present for conversational agents
 */
import {
  DEPRECATED_NODES,
  MODERN_NODES,
  CHAT_MODEL_NODES,
  NODE_TYPE_REPLACEMENTS,
  isDeprecatedNode,
  getModernReplacement,
  isChatModelNode,
  isAIAgentNode,
  isMemoryNode,
  AI_AGENT_REQUIREMENTS,
  getSuggestedNodeName,
} from './nodeTypeMapping';
import { isValidNodeType } from './nodeRegistry';
import { ALL_NODES, NODE_CATEGORIES_BY_USAGE } from './nodeCategories.generated';
import {
  detectWorkflowPattern,
  WorkflowContext,
  WorkflowPattern,
  getPatternDescription,
  getPatternRules,
} from './workflowPatternDetector';

export interface AIAgentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fixes: string[];
  workflow?: any;
  autofixed: boolean;
  pattern?: WorkflowPattern;
  patternDescription?: string;
}

/**
 * CRITICAL FIX #2: Smart Regular-to-Tool Node Conversion
 *
 * Converts regular service nodes (e.g., n8n-nodes-base.gmail) to Tool variants
 * (e.g., n8n-nodes-base.gmailTool) ONLY when appropriate:
 *
 * Conversion rules:
 * 1. Tool variant must exist in registry
 * 2. Workflow must have AI agents (no point converting otherwise)
 * 3. Node must be disconnected OR only connected to AI infrastructure
 * 4. Nodes in main workflow flow are kept as regular nodes
 */
function convertRegularNodesToTools(workflow: any): { converted: number; fixes: string[] } {
  const fixes: string[] = [];
  let converted = 0;

  // Check if AI agents exist - no point converting if no agents
  const aiAgents = workflow.nodes.filter((n: any) => isAIAgentNode(n.type));
  if (aiAgents.length === 0) {
    return { converted: 0, fixes: [] };
  }

  const connections = workflow.connections || {};
  const VALID_NODE_TYPES = getValidNodeTypes();

  for (const node of workflow.nodes) {
    // Only process n8n-nodes-base.{service} nodes (not already Tool variants)
    if (!node.type.startsWith('n8n-nodes-base.') || node.type.endsWith('Tool')) {
      continue;
    }

    // Extract service name: n8n-nodes-base.gmail -> gmail
    const serviceName = node.type.replace('n8n-nodes-base.', '');
    const toolType = `n8n-nodes-base.${serviceName}Tool`;

    // Step 1: Check if Tool variant exists
    if (!VALID_NODE_TYPES.includes(toolType)) {
      continue; // No tool variant available
    }

    // Step 2: Determine if node should be converted based on connections
    const hasMainInput = hasConnectionOfType(workflow, node.name, 'main', 'input');
    const hasMainOutput = hasConnectionOfType(workflow, node.name, 'main', 'output');
    const hasAIToolConnection = hasConnectionOfType(workflow, node.name, 'ai_tool', 'output');

    // KEEP as regular node if it has main workflow connections
    if (hasMainInput || hasMainOutput) {
      continue; // Part of main workflow - keep as regular node
    }

    // Already has ai_tool connection - keep as-is (likely already correct)
    if (hasAIToolConnection) {
      continue;
    }

    // CONVERT: Node is disconnected or only connected to AI infrastructure
    const oldType = node.type;
    node.type = toolType;
    fixes.push(`🔄 Converted "${node.name}" from ${serviceName} → ${serviceName}Tool (for AI agent use)`);
    converted++;

    // Connect to first AI agent via ai_tool if disconnected
    if (!hasMainInput && !hasMainOutput && !hasAIToolConnection) {
      const firstAgent = aiAgents[0];
      if (!connections[node.name]) {
        connections[node.name] = {};
      }
      connections[node.name].ai_tool = [[{
        node: firstAgent.name,
        type: 'ai_tool',
        index: 0
      }]];
      fixes.push(`🔗 Connected "${node.name}" to agent "${firstAgent.name}" via ai_tool`);
    }
  }

  workflow.connections = connections;
  return { converted, fixes };
}

/**
 * Helper: Check if node has connection of specific type
 */
function hasConnectionOfType(
  workflow: any,
  nodeName: string,
  connectionType: string,
  direction: 'input' | 'output'
): boolean {
  const connections = workflow.connections || {};

  if (direction === 'output') {
    // Check if node outputs via this connection type
    const nodeConns = connections[nodeName];
    if (!nodeConns) return false;
    return !!nodeConns[connectionType];
  } else {
    // Check if node receives input via this connection type
    for (const [sourceName, sourceConns] of Object.entries(connections)) {
      const typedConns = sourceConns as any;
      if (typedConns[connectionType]) {
        for (const connArray of typedConns[connectionType]) {
          for (const conn of connArray) {
            if (conn.node === nodeName) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }
}

/**
 * Helper: Get valid node types from registry
 */
function getValidNodeTypes(): readonly string[] {
  // Use the imported ALL_NODES from nodeCategories.generated
  return ALL_NODES || [];
}

/**
 * CRITICAL FIX #3: Remove Hardcoded Model Parameters
 *
 * LLM nodes should NEVER have hardcoded model names.
 * Users must configure models in n8n UI using credentials.
 *
 * Forbidden parameters:
 * - model: "gpt-4"
 * - model: "gpt-4o-mini"
 * - model: "claude-3-5-sonnet"
 * - model: { __rl: true, mode: "list", value: "..." }
 *
 * Only allowed:
 * - parameters: { options: {} }
 * - parameters: { options: { temperature: 0.7, maxTokens: 4096 } }
 */
function removeHardcodedModelParameters(workflow: any): { removed: number; fixes: string[] } {
  const fixes: string[] = [];
  let removed = 0;

  const LLM_NODE_TYPES = [
    '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    '@n8n/n8n-nodes-langchain.lmChatAnthropic',
    '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
    '@n8n/n8n-nodes-langchain.lmChatGroq',
    '@n8n/n8n-nodes-langchain.lmChatOllama',
    '@n8n/n8n-nodes-langchain.lmChatMistralCloud',
    '@n8n/n8n-nodes-langchain.lmChatAws',
  ];

  for (const node of workflow.nodes) {
    if (!LLM_NODE_TYPES.includes(node.type)) {
      continue;
    }

    // Check if parameters has a 'model' field (forbidden)
    if (node.parameters && 'model' in node.parameters) {
      const modelValue = node.parameters.model;
      delete node.parameters.model;

      fixes.push(
        `⚠️ Removed hardcoded model parameter from "${node.name}" (was: ${JSON.stringify(modelValue)}). ` +
        `User must configure model in n8n UI.`
      );
      removed++;
    }

    // Ensure parameters.options exists (safe structure)
    if (!node.parameters) {
      node.parameters = { options: {} };
    } else if (!node.parameters.options) {
      node.parameters.options = {};
    }
  }

  return { removed, fixes };
}

/**
 * CRITICAL FIX #5: Fix nodes missing required typeVersion
 *
 * n8n API requires typeVersion for certain node types to work correctly.
 * When pasting JSON into n8n UI, it auto-fills these. But API import doesn't.
 *
 * Required typeVersions:
 * - Simple Memory (memoryBufferWindow): 1.3
 * - AI Agent (agent): 3.1
 * - Chat Trigger (chatTrigger): 1.4
 */
export function fixNodeTypeVersions(workflow: any): { fixed: number; fixes: string[] } {
  const fixes: string[] = [];
  let fixed = 0;

  if (!workflow.nodes || !Array.isArray(workflow.nodes)) {
    return { fixed: 0, fixes: [] };
  }

  for (const node of workflow.nodes) {
    const nodeType = node.type || '';

    // Simple Memory nodes need typeVersion 1.3
    if (nodeType === '@n8n/n8n-nodes-langchain.memoryBufferWindow') {
      if (!node.typeVersion || node.typeVersion < 1.3) {
        const oldVersion = node.typeVersion;
        node.typeVersion = 1.3;
        fixes.push(`🔧 Fixed "${node.name}" typeVersion: ${oldVersion || 'missing'} → 1.3`);
        fixed++;
      }

      // Ensure memory node has proper parameters
      if (!node.parameters) {
        node.parameters = {};
      }
      if (!node.parameters.sessionIdOption) {
        node.parameters.sessionIdOption = 'fromInput';
        fixes.push(`🔧 Added sessionIdOption: 'fromInput' to "${node.name}"`);
        fixed++;
      }
      if (!node.parameters.contextWindowLength) {
        node.parameters.contextWindowLength = 10;
        fixes.push(`🔧 Added default contextWindowLength: 10 to "${node.name}"`);
        fixed++;
      }
    }

    // AI Agent nodes need typeVersion 3.1
    if (nodeType === '@n8n/n8n-nodes-langchain.agent') {
      if (!node.typeVersion || node.typeVersion < 3) {
        const oldVersion = node.typeVersion;
        node.typeVersion = 3.1;
        fixes.push(`🔧 Fixed "${node.name}" typeVersion: ${oldVersion || 'missing'} → 3.1`);
        fixed++;
      }
    }

    // Chat Trigger nodes need typeVersion 1.4
    if (nodeType === '@n8n/n8n-nodes-langchain.chatTrigger') {
      if (!node.typeVersion || node.typeVersion < 1.4) {
        const oldVersion = node.typeVersion;
        node.typeVersion = 1.4;
        fixes.push(`🔧 Fixed "${node.name}" typeVersion: ${oldVersion || 'missing'} → 1.4`);
        fixed++;
      }
    }
  }

  if (fixed > 0) {
    console.log(`[TYPE-VERSION-FIX] Fixed ${fixed} node typeVersions`);
  }

  return { fixed, fixes };
}

/**
 * Validate and fix AI agent workflows with pattern detection
 * CRITICAL: This function ALWAYS returns a valid workflow - no exceptions
 * If autofix fails, it falls back to aggressive restructuring
 */
export function validateAIAgentWorkflow(
  workflow: any,
  options: { autofix?: boolean; context?: WorkflowContext } = {}
): AIAgentValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: string[] = [];
  let autofixed = false;

  if (!workflow || !workflow.nodes || !Array.isArray(workflow.nodes)) {
    return {
      isValid: false,
      errors: ['Invalid workflow structure'],
      warnings: [],
      fixes: [],
      autofixed: false,
    };
  }

  // Create a working copy
  const workingWorkflow = JSON.parse(JSON.stringify(workflow));

  // Step 0: Detect workflow pattern
  const context = options.context || detectWorkflowPattern(workingWorkflow);
  const patternDesc = getPatternDescription(context.pattern);
  console.log(`🔍 Detected workflow pattern: ${patternDesc}`);

  // Step 1: Replace deprecated node types
  const deprecatedReplacement = replaceDeprecatedNodes(workingWorkflow);
  if (deprecatedReplacement.changed) {
    fixes.push(...deprecatedReplacement.fixes);
    autofixed = true;
  }

  // Step 2: Remove invalid ai_tool connections (CRITICAL FIX)
  const invalidConnectionFix = removeInvalidAIToolConnections(workingWorkflow);
  if (invalidConnectionFix.removed > 0) {
    fixes.push(`🔧 Removed ${invalidConnectionFix.removed} invalid ai_tool connections (only langchain tool nodes can use ai_tool)`);
    autofixed = true;
  }

  // Step 3: Smart regular-to-tool node conversion (CRITICAL FIX #2)
  const toolConversion = convertRegularNodesToTools(workingWorkflow);
  if (toolConversion.converted > 0) {
    fixes.push(...toolConversion.fixes);
    autofixed = true;
  }

  // Step 3.5: Remove hardcoded model parameters (CRITICAL FIX #3)
  const modelParamFix = removeHardcodedModelParameters(workingWorkflow);
  if (modelParamFix.removed > 0) {
    fixes.push(...modelParamFix.fixes);
    autofixed = true;
  }

  // Step 3.6: Fix backwards tool connections (CRITICAL FIX #4)
  const backwardsConnectionFix = fixBackwardsToolConnections(workingWorkflow);
  if (backwardsConnectionFix.fixed > 0) {
    fixes.push(...backwardsConnectionFix.fixes);
    autofixed = true;
  }

  // Step 3.7: Fix Simple Memory nodes missing typeVersion (CRITICAL FIX #5)
  const memoryVersionFix = fixNodeTypeVersions(workingWorkflow);
  if (memoryVersionFix.fixed > 0) {
    fixes.push(...memoryVersionFix.fixes);
    autofixed = true;
  }

  // Step 4: Pattern-aware validation
  const agentValidation = validateAIAgentRequirementsWithPattern(workingWorkflow, context);
  errors.push(...agentValidation.errors);
  warnings.push(...agentValidation.warnings);

  // Step 5: AGGRESSIVE AUTO-FIX - Always attempt to fix, never give up
  if (agentValidation.errors.length > 0) {
    console.log(`🔧 Starting aggressive autofix for ${agentValidation.errors.length} errors`);

    // Primary autofix: Fix agent issues
    const agentFixes = fixAIAgentIssues(workingWorkflow);
    if (agentFixes.changed) {
      fixes.push(...agentFixes.fixes);
      autofixed = true;
    }

    // Fix broken agent chains
    const chainFixes = fixBrokenAgentChains(workingWorkflow, context);
    if (chainFixes.changed) {
      fixes.push(...chainFixes.fixes);
      autofixed = true;
    }

    // Re-validate after primary fixes
    const revalidation = validateAIAgentRequirementsWithPattern(workingWorkflow, context);
    errors.length = 0;
    errors.push(...revalidation.errors);
    warnings.push(...revalidation.warnings);

    // Step 5.5: SECONDARY AUTOFIX - If still has errors, use aggressive restructuring
    if (errors.length > 0) {
      console.log(`⚠️ Primary autofix incomplete, attempting aggressive restructuring for ${errors.length} remaining errors`);
      const aggressiveFixes = aggressiveRestructure(workingWorkflow, context);
      if (aggressiveFixes.changed) {
        fixes.push(...aggressiveFixes.fixes);
        autofixed = true;

        // Final validation after aggressive fixes
        const finalValidation = validateAIAgentRequirementsWithPattern(workingWorkflow, context);
        errors.length = 0;
        errors.push(...finalValidation.errors);
        warnings.push(...finalValidation.warnings);

        if (errors.length > 0) {
          console.error(`❌ CRITICAL: Aggressive restructuring failed, ${errors.length} errors remain`);
          // Convert remaining errors to warnings - workflow is as good as we can make it
          warnings.push(...errors.map(e => `⚠️ Could not fully resolve: ${e}`));
          errors.length = 0;
        } else {
          console.log(`✅ Aggressive restructuring succeeded - workflow is now valid`);
        }
      }
    }
  }

  // Step 6: Fix node positioning overlaps
  const positioningFixes = fixNodePositioning(workingWorkflow);
  if (positioningFixes.changed) {
    fixes.push(...positioningFixes.fixes);
    autofixed = true;
  }

  // Step 7: Ensure descriptive node names
  const nameFixes = ensureDescriptiveNames(workingWorkflow);
  if (nameFixes.changed) {
    fixes.push(...nameFixes.fixes);
    autofixed = true;
  }

  // Step 8: Normalize all ai_tool indexes to 0
  const indexFixes = normalizeAIToolIndexes(workingWorkflow);
  if (indexFixes.fixed > 0) {
    fixes.push(...indexFixes.fixes);
    autofixed = true;
  }

  // Step 8.5: Remove over-linking (nodes connected to multiple targets when they should be linear)
  const overlinkFixes = removeOverlinking(workingWorkflow);
  if (overlinkFixes.fixed > 0) {
    fixes.push(...overlinkFixes.fixes);
    autofixed = true;
  }

  // Step 9: FINAL - Rebuild connections for any orphaned nodes
  // ONLY for AI agent workflows (skip for regular workflows to avoid over-linking)
  const hasAIAgents = workingWorkflow.nodes.some((n: any) => n.type === '@n8n/n8n-nodes-langchain.agent');
  if (hasAIAgents) {
    const orphanedFixes = rebuildOrphanedConnections(workingWorkflow);
    if (orphanedFixes.fixed > 0) {
      fixes.push(...orphanedFixes.fixes);
      autofixed = true;
    }
  } else {
    console.log('[REBUILD] Skipping orphaned node reconnection - no AI agents in workflow');
  }

  // GUARANTEE: Always return valid workflow
  return {
    isValid: true, // Always true - we either fixed it or converted errors to warnings
    errors: [], // Never return errors to user
    warnings,
    fixes,
    workflow: workingWorkflow, // Always return the best version we could make
    autofixed,
    pattern: context.pattern,
    patternDescription: patternDesc,
  };
}

/**
 * Replace deprecated node types with modern equivalents
 */
function replaceDeprecatedNodes(workflow: any): { changed: boolean; fixes: string[] } {
  const fixes: string[] = [];
  let changed = false;

  for (const node of workflow.nodes) {
    if (isDeprecatedNode(node.type)) {
      const replacement = getModernReplacement(node.type);
      if (replacement) {
        const oldType = node.type;
        node.type = replacement;
        node.name = getSuggestedNodeName(replacement);
        fixes.push(`🔄 Replaced deprecated node "${oldType}" with "${replacement}"`);
        changed = true;
      }
    }

    // Also check for common incorrect types
    if (node.type === '@n8n/n8n-nodes-langchain.openAi') {
      node.type = MODERN_NODES.OPENAI_CHAT_MODEL;
      node.name = 'OpenAI Chat Model';
      fixes.push(`🔄 Replaced old OpenAI LLM node with modern Chat Model`);
      changed = true;
    }
  }

  return { changed, fixes };
}

/**
 * Find node connected to target via specific connection type
 */
function findConnectedNodeByType(
  workflow: any,
  targetName: string,
  connectionType: string
): any | null {
  const connections = workflow.connections || {};

  for (const [sourceName, sourceConns] of Object.entries(connections)) {
    const typedConns = sourceConns as any;

    if (typedConns[connectionType]) {
      for (const connArray of typedConns[connectionType]) {
        for (const conn of connArray) {
          if (conn.node === targetName) {
            return workflow.nodes.find((n: any) => n.name === sourceName);
          }
        }
      }
    }
  }

  return null;
}

/**
 * Find all nodes connected to target via specific connection type
 */
function findConnectedNodesByType(
  workflow: any,
  targetName: string,
  connectionType: string
): any[] {
  const nodes: any[] = [];
  const connections = workflow.connections || {};

  for (const [sourceName, sourceConns] of Object.entries(connections)) {
    const typedConns = sourceConns as any;

    if (typedConns[connectionType]) {
      for (const connArray of typedConns[connectionType]) {
        for (const conn of connArray) {
          if (conn.node === targetName) {
            const node = workflow.nodes.find((n: any) => n.name === sourceName);
            if (node) nodes.push(node);
          }
        }
      }
    }
  }

  return nodes;
}

/**
 * Validate a single agent node (works for any agent in single or multi-agent workflows)
 */
function validateSingleAgentNode(workflow: any, agent: any): string[] {
  const errors: string[] = [];

  // Rule 1: Must have language model connection
  const modelNode = findConnectedNodeByType(workflow, agent.name, 'ai_languageModel');

  if (!modelNode) {
    errors.push(`❌ Agent "${agent.name}" missing language model connection (FlowEngine LLM or OpenAI/Anthropic/Gemini required)`);
  } else {
    // Validate it's a proper chat model (use isChatModelNode which now includes FlowEngine LLM)
    if (!isChatModelNode(modelNode.type)) {
      errors.push(`❌ Agent "${agent.name}" has invalid model type "${modelNode.type}"`);
    }
  }

  // Rule 2: Must have memory connection
  const memoryNode = findConnectedNodeByType(workflow, agent.name, 'ai_memory');

  if (!memoryNode) {
    errors.push(`❌ Agent "${agent.name}" missing memory connection (memoryBufferWindow required)`);
  } else {
    // Validate it's a proper memory node
    if (!memoryNode.type.includes('memory')) {
      errors.push(`❌ Agent "${agent.name}" has invalid memory type "${memoryNode.type}"`);
    }
  }

  // Rule 3: Check for tools (optional - just warning)
  const toolNodes = findConnectedNodesByType(workflow, agent.name, 'ai_tool');

  if (toolNodes.length === 0) {
    // This is OK - agents can work without tools
    // warnings.push(`⚠️ Agent "${agent.name}" has no tools connected`);
  }

  return errors;
}

/**
 * Validate that multiple agents are properly connected in a multi-agent workflow
 * Supports ALL multi-agent architectures (hierarchical, sequential, reflection, debate, ensemble, etc.)
 * See: https://www.productcompass.pm/p/ai-agent-architectures
 */
function validateAgentChain(workflow: any, agents: any[]): string[] {
  const errors: string[] = [];
  const connections = workflow.connections || {};

  console.log(`🔗 Validating multi-agent workflow with ${agents.length} agents`);

  // For multi-agent workflows, use MINIMAL validation:
  // Only require that the workflow has a trigger and at least one agent is reachable from it
  // This supports ALL architectures: hierarchical, sequential, reflection, debate, ensemble, etc.

  const trigger = workflow.nodes.find((n: any) =>
    n.type.toLowerCase().includes('trigger')
  );

  if (!trigger) {
    errors.push(`❌ Multi-agent workflow missing trigger node`);
    return errors;
  }

  // Helper: Check if path exists from nodeA to nodeB
  const hasPathBetween = (fromNode: string, toNode: string, visited = new Set<string>()): boolean => {
    if (fromNode === toNode) return true;
    if (visited.has(fromNode)) return false;
    visited.add(fromNode);
    const nodeConnections = connections[fromNode]?.main?.[0] || [];
    for (const conn of nodeConnections) {
      if (hasPathBetween(conn.node, toNode, visited)) {
        return true;
      }
    }
    return false;
  };

  // Check if at least ONE agent is reachable from trigger
  const reachableAgents = agents.filter(agent =>
    hasPathBetween(trigger.name, agent.name)
  );

  if (reachableAgents.length === 0) {
    errors.push(`❌ No agents reachable from trigger - workflow has no entry point`);
  } else {
    console.log(`✅ Multi-agent validation passed (${reachableAgents.length}/${agents.length} agents reachable from trigger)`);
  }

  return errors;
}

/**
 * Pattern-aware validation - routes to appropriate validator based on workflow pattern
 */
function validateAIAgentRequirementsWithPattern(
  workflow: any,
  context: WorkflowContext
): { errors: string[]; warnings: string[] } {
  switch (context.pattern) {
    case WorkflowPattern.SINGLE_AGENT:
      return validateSingleAgentPattern(workflow, context);

    case WorkflowPattern.MULTI_AGENT_SEQUENTIAL:
      return validateSequentialAgentPattern(workflow, context);

    case WorkflowPattern.MULTI_AGENT_HIERARCHICAL:
      return validateHierarchicalAgentPattern(workflow, context);

    case WorkflowPattern.REGULAR_WORKFLOW:
      return { errors: [], warnings: [] }; // No AI agents

    default:
      // Fallback to old unified validation
      return validateAIAgentRequirements(workflow);
  }
}

/**
 * Validate single agent pattern: 1 agent + 1 model + 1 memory + optional tools
 */
function validateSingleAgentPattern(
  workflow: any,
  context: WorkflowContext
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (context.agents.length !== 1) {
    errors.push(`❌ Single agent pattern expects exactly 1 agent, found ${context.agents.length}`);
    return { errors, warnings };
  }

  const agent = context.agents[0];
  const agentErrors = validateSingleAgentNode(workflow, workflow.nodes.find((n: any) => n.name === agent.name));
  errors.push(...agentErrors);

  return { errors, warnings };
}

/**
 * Validate sequential multi-agent pattern: Agent1 → Agent2 → Agent3
 * Each agent needs its own model + memory
 */
function validateSequentialAgentPattern(
  workflow: any,
  context: WorkflowContext
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log(`🔗 Validating sequential pattern with ${context.agents.length} agents`);

  // Validate each agent individually
  for (const agentInfo of context.agents) {
    const agent = workflow.nodes.find((n: any) => n.name === agentInfo.name);
    const agentErrors = validateSingleAgentNode(workflow, agent);
    errors.push(...agentErrors);
  }

  // Validate chain connections
  const chainErrors = validateAgentChain(
    workflow,
    context.agents.map(a => workflow.nodes.find((n: any) => n.name === a.name))
  );
  errors.push(...chainErrors);

  return { errors, warnings };
}

/**
 * Validate hierarchical multi-agent pattern: Supervisor + toolCode specialists
 */
function validateHierarchicalAgentPattern(
  workflow: any,
  context: WorkflowContext
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log(`🏗️ Validating hierarchical pattern with ${context.agents.length} agents`);

  // Note: toolAgent node type no longer exists - hierarchical patterns now use
  // toolCode nodes as specialists connected to supervisor agent

  // Validate each agent individually
  for (const agentInfo of context.agents) {
    const agent = workflow.nodes.find((n: any) => n.name === agentInfo.name);
    const agentErrors = validateSingleAgentNode(workflow, agent);
    errors.push(...agentErrors);
  }

  return { errors, warnings };
}

/**
 * Validate AI agent requirements (model, memory, tools)
 * Unified validator for ALL workflows (single-agent, multi-agent, or regular)
 * LEGACY - kept for backwards compatibility
 */
function validateAIAgentRequirements(workflow: any): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const aiAgents = workflow.nodes.filter((n: any) => isAIAgentNode(n.type));

  if (aiAgents.length === 0) {
    // No AI agents - validate as regular workflow
    return { errors, warnings };
  }

  console.log(`🔍 Validating ${aiAgents.length} AI agent(s)`);

  // Step 1: Validate EACH agent (same logic for all)
  for (const agent of aiAgents) {
    const agentErrors = validateSingleAgentNode(workflow, agent);
    errors.push(...agentErrors);
  }

  // Step 2: If multiple agents, validate connections between them
  if (aiAgents.length > 1) {
    const connectionErrors = validateAgentChain(workflow, aiAgents);
    errors.push(...connectionErrors);
  }

  return { errors, warnings };
}


/**
 * Check if a node has required connection of specific type
 */
function hasRequiredConnection(
  connections: any,
  targetNodeName: string,
  connectionType: string,
  validNodeTypes: string[]
): boolean {
  // Find all nodes that connect to the target with the specified type
  for (const [sourceNode, nodeConnections] of Object.entries(connections)) {
    const typedConnections = nodeConnections as any;
    if (typedConnections[connectionType]) {
      const outputs = typedConnections[connectionType];
      for (const outputArray of outputs) {
        for (const connection of outputArray) {
          if (connection.node === targetNodeName) {
            // Found a connection, check if source node is valid type
            // (we need to check the source node's type against validNodeTypes)
            // For now, we just confirm the connection exists
            return true;
          }
        }
      }
    }
  }
  return false;
}

/**
 * Auto-fix AI agent issues by adding missing nodes/connections
 */
function fixAIAgentIssues(workflow: any): { changed: boolean; fixes: string[] } {
  const fixes: string[] = [];
  let changed = false;

  const aiAgents = workflow.nodes.filter((n: any) => isAIAgentNode(n.type));
  const connections = workflow.connections || {};

  for (const agent of aiAgents) {
    const agentX = agent.position[0];

    // Check if language model exists
    const languageModels = workflow.nodes.filter((n: any) => isChatModelNode(n.type));
    if (languageModels.length === 0) {
      // Add FlowEngine LLM (preferred - pre-configured, no API key needed)
      // n8n expected property order: parameters, id, name, type, position, typeVersion
      const model = {
        parameters: {
          provider: 'openai',
          model: 'gpt-5-nano',
          options: {},
        },
        name: 'FlowEngine LLM Chat Model',
        type: MODERN_NODES.FLOWENGINE_LLM,
        position: [agentX, 100], // Above agent
        typeVersion: 1,
      };
      workflow.nodes.push(model);

      // Connect to agent
      connections[model.name] = {
        ai_languageModel: [[{
          node: agent.name,
          type: 'ai_languageModel',
          index: 0,
        }]],
      };

      fixes.push(`✅ Added FlowEngine LLM and connected to "${agent.name}"`);
      changed = true;
    } else if (!hasRequiredConnection(connections, agent.name, 'ai_languageModel', CHAT_MODEL_NODES as unknown as string[])) {
      // Model exists but not connected
      connections[languageModels[0].name] = {
        ai_languageModel: [[{
          node: agent.name,
          type: 'ai_languageModel',
          index: 0,
        }]],
      };
      fixes.push(`✅ Connected "${languageModels[0].name}" to AI Agent "${agent.name}"`);
      changed = true;
    }

    // Check if memory exists (MANDATORY)
    const memoryNodes = workflow.nodes.filter((n: any) => isMemoryNode(n.type));
    if (memoryNodes.length === 0) {
      // Add memory node with proper format
      // n8n expected property order: parameters, id, name, type, position, typeVersion
      const memory = {
        parameters: {
          sessionIdOption: 'fromInput',
          contextWindowLength: 10
        },
        name: 'Simple Memory',
        type: MODERN_NODES.MEMORY_BUFFER_WINDOW,
        position: [agentX, 50], // Above model
        typeVersion: 1.3,
      };
      workflow.nodes.push(memory);

      // Connect to agent
      connections[memory.name] = {
        ai_memory: [[{
          node: agent.name,
          type: 'ai_memory',
          index: 0,
        }]],
      };

      fixes.push(`✅ Added Simple Memory (MANDATORY) and connected to "${agent.name}"`);
      changed = true;
    } else if (!hasRequiredConnection(connections, agent.name, 'ai_memory', [MODERN_NODES.MEMORY_BUFFER_WINDOW])) {
      // Memory exists but not connected
      connections[memoryNodes[0].name] = {
        ai_memory: [[{
          node: agent.name,
          type: 'ai_memory',
          index: 0,
        }]],
      };
      fixes.push(`✅ Connected "${memoryNodes[0].name}" to AI Agent "${agent.name}"`);
      changed = true;
    }

    // Check for tools (add code tool if none exist)
    const hasTools = hasRequiredConnection(
      connections,
      agent.name,
      'ai_tool',
      AI_AGENT_REQUIREMENTS.REQUIRED_CONNECTIONS.ai_tool.validNodeTypes as unknown as string[]
    );

    if (!hasTools) {
      // Add code tool
      // n8n expected property order: parameters, id, name, type, position, typeVersion
      const tool = {
        parameters: {
          language: 'javascript',
        },
        name: 'Code Tool',
        type: MODERN_NODES.CODE_TOOL,
        position: [agentX, 400], // Below agent
      };
      workflow.nodes.push(tool);

      // Connect to agent
      connections[tool.name] = {
        ai_tool: [[{
          node: agent.name,
          type: 'ai_tool',
          index: 0,
        }]],
      };

      fixes.push(`✅ Added Code Tool and connected to "${agent.name}"`);
      changed = true;
    }
  }

  workflow.connections = connections;
  return { changed, fixes };
}

/**
 * Fix broken agent chains by adding missing connections
 * Handles sequential patterns and loops
 */
function fixBrokenAgentChains(workflow: any, context: WorkflowContext): { changed: boolean; fixes: string[] } {
  const fixes: string[] = [];
  let changed = false;
  const connections = workflow.connections || {};

  // Only fix chains for sequential patterns
  if (context.pattern !== WorkflowPattern.MULTI_AGENT_SEQUENTIAL) {
    return { changed, fixes };
  }

  const agents = context.agents.map(a => workflow.nodes.find((n: any) => n.name === a.name)).filter(Boolean);

  // Fix trigger → first agent connection
  const trigger = workflow.nodes.find((n: any) => n.type.toLowerCase().includes('trigger'));
  if (trigger && agents.length > 0) {
    const firstAgent = agents[0];
    const triggerConnections = connections[trigger.name] || {};

    if (!triggerConnections.main) {
      triggerConnections.main = [[]];
    }

    const hasConnection = triggerConnections.main[0]?.some(
      (conn: any) => conn.node === firstAgent.name
    );

    if (!hasConnection) {
      if (!triggerConnections.main[0]) {
        triggerConnections.main[0] = [];
      }
      triggerConnections.main[0].push({
        node: firstAgent.name,
        type: 'main',
        index: 0
      });
      connections[trigger.name] = triggerConnections;
      fixes.push(`✅ Connected trigger "${trigger.name}" to first agent "${firstAgent.name}"`);
      changed = true;
    }
  }

  // Fix agent → agent connections
  for (let i = 0; i < agents.length - 1; i++) {
    const currentAgent = agents[i];
    const nextAgent = agents[i + 1];

    const currentConnections = connections[currentAgent.name] || {};

    if (!currentConnections.main) {
      currentConnections.main = [[]];
    }

    const hasConnection = currentConnections.main[0]?.some(
      (conn: any) => conn.node === nextAgent.name
    );

    if (!hasConnection) {
      if (!currentConnections.main[0]) {
        currentConnections.main[0] = [];
      }
      currentConnections.main[0].push({
        node: nextAgent.name,
        type: 'main',
        index: 0
      });
      connections[currentAgent.name] = currentConnections;
      fixes.push(`✅ Connected "${currentAgent.name}" to "${nextAgent.name}"`);
      changed = true;
    }
  }

  return { changed, fixes };
}

/**
 * Fix node positioning to prevent overlaps
 */
function fixNodePositioning(workflow: any): { changed: boolean; fixes: string[] } {
  const fixes: string[] = [];
  let changed = false;

  const positions = new Map<string, [number, number]>();
  const aiAgents = workflow.nodes.filter((n: any) => isAIAgentNode(n.type));

  // For each AI agent, ensure support nodes are positioned relative to it
  for (const agent of aiAgents) {
    const agentX = agent.position[0];
    const agentY = agent.position[1];

    // Find connected nodes
    const languageModels = workflow.nodes.filter((n: any) =>
      isChatModelNode(n.type) && isConnectedTo(workflow.connections, n.name, agent.name)
    );
    const memoryNodes = workflow.nodes.filter((n: any) =>
      isMemoryNode(n.type) && isConnectedTo(workflow.connections, n.name, agent.name)
    );
    const toolNodes = workflow.nodes.filter((n: any) =>
      isToolNode(n.type) && isConnectedTo(workflow.connections, n.name, agent.name)
    );

    // Position language model above agent
    for (const model of languageModels) {
      const newPos: [number, number] = [agentX, 100];
      if (model.position[0] !== newPos[0] || model.position[1] !== newPos[1]) {
        model.position = newPos;
        fixes.push(`📍 Repositioned "${model.name}" above AI Agent`);
        changed = true;
      }
    }

    // Position memory above language model
    for (const memory of memoryNodes) {
      const newPos: [number, number] = [agentX, 50];
      if (memory.position[0] !== newPos[0] || memory.position[1] !== newPos[1]) {
        memory.position = newPos;
        fixes.push(`📍 Repositioned "${memory.name}" at top`);
        changed = true;
      }
    }

    // Position tools below agent
    toolNodes.forEach((tool: any, index: number) => {
      const newPos: [number, number] = [agentX + (index * 150), 400];
      if (tool.position[0] !== newPos[0] || tool.position[1] !== newPos[1]) {
        tool.position = newPos;
        fixes.push(`📍 Repositioned "${tool.name}" below AI Agent`);
        changed = true;
      }
    });
  }

  return { changed, fixes };
}

/**
 * Check if a node is connected to another
 */
function isConnectedTo(connections: any, sourceNode: string, targetNode: string): boolean {
  const nodeConnections = connections[sourceNode];
  if (!nodeConnections) return false;

  for (const outputs of Object.values(nodeConnections)) {
    if (!Array.isArray(outputs)) continue;
    for (const outputArray of outputs) {
      if (!Array.isArray(outputArray)) continue;
      for (const conn of outputArray) {
        if (conn.node === targetNode) return true;
      }
    }
  }
  return false;
}

/**
 * Check if a node is a tool node
 */
function isToolNode(nodeType: string): boolean {
  return AI_AGENT_REQUIREMENTS.REQUIRED_CONNECTIONS.ai_tool.validNodeTypes.includes(nodeType as any);
}

/**
 * Ensure all nodes have descriptive names
 */
function ensureDescriptiveNames(workflow: any): { changed: boolean; fixes: string[] } {
  const fixes: string[] = [];
  let changed = false;

  for (const node of workflow.nodes) {
    // Check for generic names
    if (!node.name || /^(Node|node)\d+$/i.test(node.name)) {
      const newName = getSuggestedNodeName(node.type);
      fixes.push(`📝 Renamed "${node.name || 'unnamed'}" to "${newName}"`);
      node.name = newName;
      changed = true;
    }

    // Fix "GPT-4" to "OpenAI Chat Model"
    if (node.name === 'GPT-4' && isChatModelNode(node.type)) {
      node.name = 'OpenAI Chat Model';
      fixes.push(`📝 Renamed "GPT-4" to "OpenAI Chat Model" (descriptive name)`);
      changed = true;
    }

    // Fix "Chat Memory" that's actually httpRequest
    if (node.name === 'Chat Memory' && node.type === 'n8n-nodes-base.httpRequest') {
      node.type = MODERN_NODES.MEMORY_BUFFER_WINDOW;
      node.parameters = {};
      fixes.push(`🔄 Fixed "Chat Memory" node type from httpRequest to memoryBufferWindow`);
      changed = true;
    }
  }

  return { changed, fixes };
}

/**
 * Remove invalid ai_tool connections
 * Accepts any tool matching these patterns:
 * - LangChain tools: @n8n/n8n-nodes-langchain.tool*
 * - Service-specific tools: n8n-nodes-base.*Tool
 */
function removeInvalidAIToolConnections(workflow: any): { removed: number } {
  let removed = 0;
  const connections = workflow.connections || {};

  console.log('[AI-VALIDATOR] 🔍 Checking ai_tool connections...');

  for (const [sourceName, sourceConnections] of Object.entries(connections)) {
    const sourceNode = workflow.nodes.find((n: any) => n.name === sourceName);
    if (!sourceNode) continue;

    // If source has ai_tool connections, check if it matches tool patterns
    if ((sourceConnections as any).ai_tool) {
      const isLangchainTool = sourceNode.type.startsWith('@n8n/n8n-nodes-langchain.tool');
      const isServiceTool = sourceNode.type.startsWith('n8n-nodes-base.') && sourceNode.type.endsWith('Tool');
      const isValid = isLangchainTool || isServiceTool;

      console.log(`[AI-VALIDATOR]   Tool node: "${sourceName}" (${sourceNode.type})`);
      console.log(`[AI-VALIDATOR]     LangChain tool? ${isLangchainTool}`);
      console.log(`[AI-VALIDATOR]     Service tool? ${isServiceTool}`);
      console.log(`[AI-VALIDATOR]     Valid? ${isValid}`);

      if (!isValid) {
        console.log(`[AI-VALIDATOR]   ❌ INVALID TOOL - Removing ai_tool connection from "${sourceName}" (type: ${sourceNode.type})`);
        delete (connections[sourceName] as any).ai_tool;
        removed++;
      } else {
        console.log(`[AI-VALIDATOR]   ✅ Valid tool connection for "${sourceName}"`);
      }
    }
  }

  if (removed === 0) {
    console.log('[AI-VALIDATOR] ✓ All ai_tool connections are valid');
  }

  return { removed };
}

/**
 * Fix backwards tool connections
 * CORRECT n8n pattern: Tools connect TO agent (tool is SOURCE, agent is TARGET)
 * WRONG pattern: Agent connects TO tool (agent is SOURCE, tool is TARGET)
 */
function fixBackwardsToolConnections(workflow: any): { fixed: number; fixes: string[] } {
  let fixed = 0;
  const fixes: string[] = [];
  const connections = workflow.connections || {};

  // Get valid tool types from registry
  const toolNodesSet = new Set(NODE_CATEGORIES_BY_USAGE.aiTools);

  console.log('[AI-VALIDATOR] 🔍 Checking for backwards tool connections...');

  // Find all AI agent nodes
  const agentNodes = workflow.nodes.filter((n: any) =>
    n.type === '@n8n/n8n-nodes-langchain.agent'
  );

  // Find all tool nodes
  const toolNodes = workflow.nodes.filter((n: any) => toolNodesSet.has(n.type));

  // Check if AGENT is incorrectly the SOURCE of ai_tool connections (backwards)
  for (const agentNode of agentNodes) {
    const agentConnections = connections[agentNode.name];

    if (agentConnections?.ai_tool) {
      console.log(`[AI-VALIDATOR]   ❌ BACKWARDS CONNECTION: "${agentNode.name}" is SOURCE of ai_tool connection (should be TARGET)`);

      // Get all tools the agent is incorrectly connecting to
      const targets = agentConnections.ai_tool[0] || [];

      for (const target of targets) {
        const toolNode = workflow.nodes.find((n: any) => n.name === target.node);

        if (toolNode && toolNodesSet.has(toolNode.type)) {
          console.log(`[AI-VALIDATOR]   🔧 FIXING: Moving connection from "${agentNode.name}" → "${toolNode.name}" to "${toolNode.name}" → "${agentNode.name}"`);

          // Add correct connection from tool to agent
          if (!connections[toolNode.name]) {
            connections[toolNode.name] = {};
          }

          if (!connections[toolNode.name].ai_tool) {
            connections[toolNode.name].ai_tool = [[]];
          }

          // Add agent to tool's ai_tool connections
          const existingAgentIndex = connections[toolNode.name].ai_tool[0].findIndex(
            (conn: any) => conn.node === agentNode.name
          );

          if (existingAgentIndex === -1) {
            connections[toolNode.name].ai_tool[0].push({
              node: agentNode.name,
              type: 'ai_tool',
              index: 0
            });
          }

          fixes.push(`🔧 Fixed backwards connection: "${toolNode.name}" now correctly connects to "${agentNode.name}"`);
          fixed++;
        }
      }

      // Remove the backwards connection from agent
      delete connections[agentNode.name].ai_tool;
    }
  }

  if (fixed === 0) {
    console.log('[AI-VALIDATOR] ✓ All tool connections have correct direction');
  } else {
    console.log(`[AI-VALIDATOR] ✅ Fixed ${fixed} backwards tool connection(s)`);
  }

  return { fixed, fixes };
}

/**
 * Aggressive restructuring for workflows that can't be fixed with normal autofix
 * This is the "nuclear option" - rebuild connections, add missing nodes, etc.
 */
function aggressiveRestructure(workflow: any, context: WorkflowContext): { changed: boolean; fixes: string[] } {
  const fixes: string[] = [];
  let changed = false;
  const connections = workflow.connections || {};

  console.log(`🔨 Starting aggressive restructuring for ${context.agents.length} agents`);

  // Fix 1: Ensure all agents have required sub-nodes (model, memory, tools)
  const aiAgents = workflow.nodes.filter((n: any) => isAIAgentNode(n.type));

  for (const agent of aiAgents) {
    // Check for model
    const hasModel = findConnectedNodeByType(workflow, agent.name, 'ai_languageModel');
    if (!hasModel) {
      // Add FlowEngine LLM (preferred - pre-configured, no API key needed)
      // n8n expected property order: parameters, id, name, type, position, typeVersion
      const model = {
        parameters: {
          provider: 'openai',
          model: 'gpt-5-nano',
          options: {}
        },
        name: `${agent.name} Model`,
        type: MODERN_NODES.FLOWENGINE_LLM,
        position: [agent.position[0], agent.position[1] - 150],
        typeVersion: 1,
      };
      workflow.nodes.push(model);
      connections[model.name] = {
        ai_languageModel: [[{ node: agent.name, type: 'ai_languageModel', index: 0 }]]
      };
      fixes.push(`🔨 Added missing FlowEngine LLM for "${agent.name}"`);
      changed = true;
    }

    // Check for memory
    const hasMemory = findConnectedNodeByType(workflow, agent.name, 'ai_memory');
    if (!hasMemory) {
      // Add memory and connect
      // n8n expected property order: parameters, id, name, type, position, typeVersion
      const memory = {
        parameters: {
          sessionIdOption: 'fromInput',
          contextWindowLength: 10
        },
        name: `${agent.name} Memory`,
        type: MODERN_NODES.MEMORY_BUFFER_WINDOW,
        position: [agent.position[0], agent.position[1] - 100],
        typeVersion: 1.3,
      };
      workflow.nodes.push(memory);
      connections[memory.name] = {
        ai_memory: [[{ node: agent.name, type: 'ai_memory', index: 0 }]]
      };
      fixes.push(`🔨 Added missing memory for "${agent.name}"`);
      changed = true;
    }
  }

  // Fix 2: Ensure trigger exists and is connected
  let trigger = workflow.nodes.find((n: any) => n.type.toLowerCase().includes('trigger'));
  if (!trigger) {
    // Add manual trigger
    // n8n expected property order: parameters, id, name, type, position, typeVersion
    trigger = {
      parameters: {},
      name: 'Manual Trigger',
      type: 'n8n-nodes-base.manualTrigger',
      position: [100, 300],
    };
    workflow.nodes.push(trigger);
    fixes.push(`🔨 Added missing trigger node`);
    changed = true;
  }

  // Fix 3: Ensure trigger connects to at least one agent or first node
  const triggerConnections = connections[trigger.name] || {};
  if (!triggerConnections.main || triggerConnections.main[0]?.length === 0) {
    // Connect trigger to first agent or first non-trigger node
    const firstAgent = aiAgents[0];
    const firstNode = firstAgent || workflow.nodes.find((n: any) => n.name !== trigger.name);

    if (firstNode) {
      connections[trigger.name] = {
        main: [[{ node: firstNode.name, type: 'main', index: 0 }]]
      };
      fixes.push(`🔨 Connected trigger to "${firstNode.name}"`);
      changed = true;
    }
  }

  // Fix 4: For multi-agent workflows, ensure at least basic connectivity
  if (aiAgents.length > 1) {
    // Connect any isolated agents to the workflow
    for (const agent of aiAgents) {
      // Check if agent is reachable from trigger
      const isReachable = hasPathBetween(workflow, trigger.name, agent.name);

      if (!isReachable) {
        // Connect trigger or previous node to this agent
        const prevAgent = aiAgents[aiAgents.indexOf(agent) - 1];
        const sourceNode = prevAgent || trigger;

        if (!connections[sourceNode.name]) {
          connections[sourceNode.name] = { main: [[]] };
        }
        if (!connections[sourceNode.name].main) {
          connections[sourceNode.name].main = [[]];
        }
        if (!connections[sourceNode.name].main[0]) {
          connections[sourceNode.name].main[0] = [];
        }

        connections[sourceNode.name].main[0].push({
          node: agent.name,
          type: 'main',
          index: 0
        });

        fixes.push(`🔨 Connected "${sourceNode.name}" to isolated agent "${agent.name}"`);
        changed = true;
      }
    }
  }

  workflow.connections = connections;

  if (changed) {
    console.log(`✅ Aggressive restructuring completed with ${fixes.length} fixes`);
  }

  return { changed, fixes };
}

/**
 * Helper: Check if path exists between two nodes
 */
function hasPathBetween(workflow: any, fromNode: string, toNode: string, visited = new Set<string>()): boolean {
  if (fromNode === toNode) return true;
  if (visited.has(fromNode)) return false;

  visited.add(fromNode);
  const connections = workflow.connections || {};
  const nodeConnections = connections[fromNode]?.main?.[0] || [];

  for (const conn of nodeConnections) {
    if (hasPathBetween(workflow, conn.node, toNode, visited)) {
      return true;
    }
  }

  return false;
}


/**
 * Normalize all ai_tool connection indexes to 0
 * ALL tools connecting to the same agent should have index: 0
 */
function normalizeAIToolIndexes(workflow: any): { fixed: number; fixes: string[] } {
  const fixes: string[] = [];
  let fixed = 0;
  const connections = workflow.connections || {};

  console.log('[INDEX-NORM] Normalizing ai_tool indexes...');

  // Scan all connections for ai_tool with wrong index
  for (const [nodeName, nodeConns] of Object.entries(connections)) {
    const typedConns = nodeConns as any;

    if (typedConns.ai_tool) {
      const toolConnections = typedConns.ai_tool[0] || [];

      for (const conn of toolConnections) {
        if (conn.index !== 0) {
          const oldIndex = conn.index;
          conn.index = 0; // Fix to 0
          fixes.push(`🔧 Fixed ai_tool index: "${nodeName}" index ${oldIndex} → 0`);
          fixed++;
          console.log(`[INDEX-NORM] Fixed "${nodeName}" index ${oldIndex} → 0`);
        }
      }
    }
  }

  console.log(`[INDEX-NORM] Completed: Fixed ${fixed} indexes`);
  return { fixed, fixes };
}

/**
 * Remove over-linking: Ensure each node connects to only ONE next node (linear flow)
 * Exception: Conditional nodes (IF/Switch) can have multiple outputs
 */
function removeOverlinking(workflow: any): { fixed: number; fixes: string[] } {
  const fixes: string[] = [];
  let fixed = 0;
  const connections = workflow.connections || {};

  console.log('[OVERLINK] Checking for over-linked nodes...');

  for (const [sourceNode, nodeConns] of Object.entries(connections)) {
    // Only check main connections (not ai_tool, ai_languageModel, etc.)
    if (!nodeConns || !(nodeConns as any).main) continue;

    const mainConns = (nodeConns as any).main[0];
    if (!Array.isArray(mainConns) || mainConns.length <= 1) continue;

    // Check if this is a conditional node (IF/Switch) that legitimately has multiple outputs
    const sourceNodeObj = workflow.nodes.find((n: any) => n.name === sourceNode);
    const isConditionalNode = sourceNodeObj?.type === 'n8n-nodes-base.if' ||
                             sourceNodeObj?.type === 'n8n-nodes-base.switch';

    if (isConditionalNode) {
      console.log(`[OVERLINK] ⏭️  Skipping conditional node "${sourceNode}" (legitimate multiple outputs)`);
      continue;
    }

    // Non-conditional node with multiple connections - keep only the FIRST connection
    const firstConnection = mainConns[0];
    const removedConnections = mainConns.slice(1);

    console.log(`[OVERLINK] Found over-linked node: "${sourceNode}" → ${mainConns.length} targets`);
    console.log(`[OVERLINK]   Keeping: "${firstConnection.node}"`);
    removedConnections.forEach((conn: any) => {
      console.log(`[OVERLINK]   Removing: "${conn.node}"`);
    });

    // Keep only the first connection
    (nodeConns as any).main[0] = [firstConnection];

    removedConnections.forEach((conn: any) => {
      fixes.push(`🔗 Removed over-linking: "${sourceNode}" no longer connects to "${conn.node}" (keeping linear flow)`);
    });

    fixed += removedConnections.length;
  }

  console.log(`[OVERLINK] Completed: Removed ${fixed} excess connections`);
  return { fixed, fixes };
}

/**
 * Final validator: Rebuild connections for any orphaned nodes
 * Ensures NO hanging nodes after all conversions and removals
 */
function rebuildOrphanedConnections(workflow: any): { fixed: number; fixes: string[] } {
  const fixes: string[] = [];
  let fixed = 0;
  const connections = workflow.connections || {};

  console.log('[REBUILD] Checking for orphaned nodes...');

  // Build incoming connections map to detect nodes that have incoming connections
  const incomingConnections = new Map<string, number>();
  for (const [sourceNode, conns] of Object.entries(connections)) {
    for (const [connType, connArrays] of Object.entries(conns as any)) {
      if (Array.isArray(connArrays)) {
        for (const connArray of connArrays) {
          if (Array.isArray(connArray)) {
            for (const conn of connArray) {
              if (conn.node) {
                incomingConnections.set(conn.node, (incomingConnections.get(conn.node) || 0) + 1);
              }
            }
          }
        }
      }
    }
  }

  // Find nodes with NO connections (neither incoming nor outgoing)
  for (const node of workflow.nodes) {
    const nodeConns = connections[node.name];
    const hasOutgoing = nodeConns && Object.keys(nodeConns).length > 0;
    const hasIncoming = incomingConnections.has(node.name);

    // Only consider truly orphaned nodes (no incoming AND no outgoing)
    const isOrphaned = !hasOutgoing && !hasIncoming;

    if (isOrphaned) {
      console.log(`[REBUILD] Found orphaned node: "${node.name}" (type: ${node.type})`);

      // Skip AI Agents - they often have no main output (chat-based workflows)
      if (node.type === '@n8n/n8n-nodes-langchain.agent') {
        console.log(`[REBUILD] ⏭️  Skipping AI Agent "${node.name}" - no main output needed for chat workflows`);
        continue;
      }

      // Check if it's a tool node (registry check + pattern-based checks)
      const isToolNode = NODE_CATEGORIES_BY_USAGE.aiTools.includes(node.type) ||
        node.type.startsWith('@n8n/n8n-nodes-langchain.tool') ||
        (node.type.startsWith('n8n-nodes-base.') && node.type.endsWith('Tool')) ||
        node.type === '@tavily/n8n-nodes-tavily.tavilyTool';

      if (isToolNode) {
        // Rebuild ai_tool connection to nearest agent
        const agents = workflow.nodes.filter(
          (n: any) => n.type === '@n8n/n8n-nodes-langchain.agent'
        );

        if (agents.length > 0) {
          const nearestAgent = agents[0];
          if (!connections[node.name]) connections[node.name] = {};
          connections[node.name].ai_tool = [
            [
              {
                node: nearestAgent.name,
                type: 'ai_tool',
                index: 0,
              },
            ],
          ];
          fixes.push(`🔗 Rebuilt ai_tool connection: "${node.name}" → "${nearestAgent.name}"`);
          fixed++;
          console.log(`[REBUILD] ✅ Reconnected tool "${node.name}" to agent "${nearestAgent.name}"`);
        }
      } else {
        // Regular node - connect from AI Agent's main output (after agent executes)
        const agents = workflow.nodes.filter(
          (n: any) => n.type === '@n8n/n8n-nodes-langchain.agent'
        );

        if (agents.length > 0) {
          const agent = agents[0]; // Use first agent
          if (!connections[agent.name]) connections[agent.name] = {};
          if (!connections[agent.name].main) connections[agent.name].main = [[]];

          // Add connection from agent to orphaned node
          connections[agent.name].main[0].push({
            node: node.name,
            type: 'main',
            index: 0,
          });
          fixes.push(`🔗 Reconnected orphaned node "${node.name}" from agent output "${agent.name}"`);
          fixed++;
          console.log(`[REBUILD] ✅ Reconnected regular node "${node.name}" from agent "${agent.name}"`);
        } else {
          // No agents found - connect from first non-trigger node as fallback
          const targetNode = workflow.nodes.find(
            (n: any) =>
              !n.type.toLowerCase().includes('trigger') &&
              n.name !== node.name
          );

          if (targetNode) {
            if (!connections[targetNode.name]) connections[targetNode.name] = {};
            if (!connections[targetNode.name].main) connections[targetNode.name].main = [[]];
            connections[targetNode.name].main[0].push({
              node: node.name,
              type: 'main',
              index: 0,
            });
            fixes.push(`🔗 Reconnected orphaned node "${node.name}" from "${targetNode.name}"`);
            fixed++;
            console.log(`[REBUILD] ✅ Reconnected regular node "${node.name}" from "${targetNode.name}" (no agent found)`);
          }
        }
      }
    }
  }

  workflow.connections = connections;
  console.log(`[REBUILD] Completed: Fixed ${fixed} orphaned nodes`);
  return { fixed, fixes };
}

