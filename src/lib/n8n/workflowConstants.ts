/**
 * N8N Workflow Constants
 *
 * These constants are defined directly because n8n-workflow has Node.js dependencies
 * (os, timers, xml2js, recast) that cannot be bundled for Next.js browser/edge runtime.
 *
 * Values sourced from: node_modules/n8n-workflow/dist/cjs/constants.js
 * To verify/update: run `node -e "const c = require('n8n-workflow'); console.log(c.STARTING_NODE_TYPES)"`
 */

/**
 * Node Type Constants
 * Values match n8n-workflow package constants
 */
export const NODE_TYPES = {
  ERROR_TRIGGER: 'n8n-nodes-base.errorTrigger',
  MANUAL_TRIGGER: 'n8n-nodes-base.manualTrigger',
  WEBHOOK: 'n8n-nodes-base.webhook',
  START: 'n8n-nodes-base.start',
  EXECUTE_WORKFLOW_TRIGGER: 'n8n-nodes-base.executeWorkflowTrigger',
} as const;

/**
 * Official starting node types from n8n-workflow package
 * These are trigger nodes that can start a workflow
 */
export const STARTING_NODE_TYPES = [
  'n8n-nodes-base.manualTrigger',
  'n8n-nodes-base.executeWorkflowTrigger',
  'n8n-nodes-base.errorTrigger',
  'n8n-nodes-base.start',
  'n8n-nodes-base.evaluationTrigger',
  'n8n-nodes-base.formTrigger',
] as const;

/**
 * Node Retry Configuration
 * From INode interface
 */
export const NODE_RETRY_DEFAULTS = {
  retryOnFail: false,
  RECOMMENDED_MAX_TRIES: 3,
  RECOMMENDED_WAIT_MS: 5000,
  DATABASE_MAX_TRIES: 2,
  DATABASE_WAIT_MS: 3000,
} as const;

/**
 * Node Error Handling
 * From INode interface
 */
export const NODE_ON_ERROR = {
  CONTINUE_ERROR_OUTPUT: 'continueErrorOutput',
  CONTINUE_REGULAR_OUTPUT: 'continueRegularOutput',
  STOP_WORKFLOW: 'stopWorkflow',
} as const;

/**
 * Workflow Settings
 * From IWorkflowSettings interface
 */
export const WORKFLOW_SETTINGS_DEFAULTS = {
  CALLER_POLICY: {
    ANY: 'any',
    NONE: 'none',
    WORKFLOWS_FROM_A_LIST: 'workflowsFromAList',
    WORKFLOWS_FROM_SAME_OWNER: 'workflowsFromSameOwner',
  },
  SAVE_DATA_EXECUTION: {
    DEFAULT: 'DEFAULT',
    ALL: 'all',
    NONE: 'none',
  },
  EXECUTION_ORDER: {
    V0: 'v0',
    V1: 'v1',
  },
} as const;

/**
 * Recommended Production Workflow Settings
 */
export const PRODUCTION_WORKFLOW_SETTINGS = {
  saveDataErrorExecution: WORKFLOW_SETTINGS_DEFAULTS.SAVE_DATA_EXECUTION.ALL,
  saveDataSuccessExecution: WORKFLOW_SETTINGS_DEFAULTS.SAVE_DATA_EXECUTION.ALL,
  saveManualExecutions: true,
  executionOrder: WORKFLOW_SETTINGS_DEFAULTS.EXECUTION_ORDER.V1,
  callerPolicy: WORKFLOW_SETTINGS_DEFAULTS.CALLER_POLICY.WORKFLOWS_FROM_SAME_OWNER,
} as const;

/**
 * Node types that typically require retry on fail
 */
export const RETRY_RECOMMENDED_NODE_PATTERNS = [
  'httpRequest',
  'http',
  'webhook',
  'api',
  'mysql',
  'postgres',
  'mongodb',
  'redis',
  'elasticsearch',
  'gmail',
  'slack',
  'discord',
  'telegram',
  'shopify',
  'stripe',
  'salesforce',
  'hubspot',
] as const;

/**
 * Check if a node type should have retry enabled by default
 */
export function shouldEnableRetry(nodeType: string): boolean {
  const lowerType = nodeType.toLowerCase();
  return RETRY_RECOMMENDED_NODE_PATTERNS.some(pattern =>
    lowerType.includes(pattern)
  );
}

/**
 * Get recommended retry settings for a node type
 */
export function getRecommendedRetrySettings(nodeType: string): {
  retryOnFail: boolean;
  maxTries: number;
  waitBetweenTries: number;
} | null {
  if (!shouldEnableRetry(nodeType)) {
    return null;
  }

  const isDatabaseNode = nodeType.toLowerCase().match(/mysql|postgres|mongodb|redis|elasticsearch/);

  if (isDatabaseNode) {
    return {
      retryOnFail: true,
      maxTries: NODE_RETRY_DEFAULTS.DATABASE_MAX_TRIES,
      waitBetweenTries: NODE_RETRY_DEFAULTS.DATABASE_WAIT_MS,
    };
  }

  return {
    retryOnFail: true,
    maxTries: NODE_RETRY_DEFAULTS.RECOMMENDED_MAX_TRIES,
    waitBetweenTries: NODE_RETRY_DEFAULTS.RECOMMENDED_WAIT_MS,
  };
}

/**
 * Check if a node is a trigger/starting node
 */
export function isStartingNode(nodeType: string): boolean {
  return STARTING_NODE_TYPES.includes(nodeType as any);
}
