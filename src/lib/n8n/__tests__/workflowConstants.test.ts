import { describe, it, expect } from 'vitest';
import {
  shouldEnableRetry,
  getRecommendedRetrySettings,
  isStartingNode,
  STARTING_NODE_TYPES,
  NODE_RETRY_DEFAULTS,
  PRODUCTION_WORKFLOW_SETTINGS,
} from '@/lib/n8n/workflowConstants';

// ─── shouldEnableRetry ────────────────────────────────────────────────────────

describe('shouldEnableRetry', () => {
  it('returns true for HTTP-related node types', () => {
    expect(shouldEnableRetry('n8n-nodes-base.httpRequest')).toBe(true);
    expect(shouldEnableRetry('n8n-nodes-base.webhook')).toBe(true);
  });

  it('returns true for communication service nodes', () => {
    expect(shouldEnableRetry('n8n-nodes-base.gmail')).toBe(true);
    expect(shouldEnableRetry('n8n-nodes-base.slack')).toBe(true);
    expect(shouldEnableRetry('n8n-nodes-base.telegram')).toBe(true);
  });

  it('returns true for database nodes', () => {
    expect(shouldEnableRetry('n8n-nodes-base.postgres')).toBe(true);
    expect(shouldEnableRetry('n8n-nodes-base.mysql')).toBe(true);
    expect(shouldEnableRetry('n8n-nodes-base.redis')).toBe(true);
  });

  it('returns false for code / set / if nodes', () => {
    expect(shouldEnableRetry('n8n-nodes-base.code')).toBe(false);
    expect(shouldEnableRetry('n8n-nodes-base.set')).toBe(false);
    expect(shouldEnableRetry('n8n-nodes-base.if')).toBe(false);
  });

  it('returns false for AI sub-nodes (model, memory)', () => {
    expect(shouldEnableRetry('@n8n/n8n-nodes-langchain.lmChatOpenAi')).toBe(false);
    expect(shouldEnableRetry('@n8n/n8n-nodes-langchain.memoryBufferWindow')).toBe(false);
  });
});

// ─── getRecommendedRetrySettings ─────────────────────────────────────────────

describe('getRecommendedRetrySettings', () => {
  it('returns null for nodes that should not retry', () => {
    expect(getRecommendedRetrySettings('n8n-nodes-base.code')).toBeNull();
    expect(getRecommendedRetrySettings('n8n-nodes-base.set')).toBeNull();
  });

  it('returns standard retry settings for API/HTTP nodes', () => {
    const settings = getRecommendedRetrySettings('n8n-nodes-base.httpRequest');
    expect(settings).not.toBeNull();
    expect(settings!.retryOnFail).toBe(true);
    expect(settings!.maxTries).toBe(NODE_RETRY_DEFAULTS.RECOMMENDED_MAX_TRIES);
    expect(settings!.waitBetweenTries).toBe(NODE_RETRY_DEFAULTS.RECOMMENDED_WAIT_MS);
  });

  it('returns database-specific retry settings for DB nodes', () => {
    const pgSettings = getRecommendedRetrySettings('n8n-nodes-base.postgres');
    expect(pgSettings!.maxTries).toBe(NODE_RETRY_DEFAULTS.DATABASE_MAX_TRIES);
    expect(pgSettings!.waitBetweenTries).toBe(NODE_RETRY_DEFAULTS.DATABASE_WAIT_MS);

    const mysqlSettings = getRecommendedRetrySettings('n8n-nodes-base.mysql');
    expect(mysqlSettings!.maxTries).toBe(NODE_RETRY_DEFAULTS.DATABASE_MAX_TRIES);
  });
});

// ─── isStartingNode ───────────────────────────────────────────────────────────

describe('isStartingNode', () => {
  it('returns true for official starting node types', () => {
    expect(isStartingNode('n8n-nodes-base.manualTrigger')).toBe(true);
    expect(isStartingNode('n8n-nodes-base.executeWorkflowTrigger')).toBe(true);
    expect(isStartingNode('n8n-nodes-base.errorTrigger')).toBe(true);
    expect(isStartingNode('n8n-nodes-base.formTrigger')).toBe(true);
  });

  it('returns false for non-trigger nodes', () => {
    expect(isStartingNode('n8n-nodes-base.slack')).toBe(false);
    expect(isStartingNode('@n8n/n8n-nodes-langchain.agent')).toBe(false);
    expect(isStartingNode('n8n-nodes-base.httpRequest')).toBe(false);
  });

  it('returns false for webhook (not in STARTING_NODE_TYPES list)', () => {
    // n8n-nodes-base.webhook is NOT in STARTING_NODE_TYPES (different from manualTrigger)
    expect(isStartingNode('n8n-nodes-base.webhook')).toBe(false);
  });
});

// ─── PRODUCTION_WORKFLOW_SETTINGS ────────────────────────────────────────────

describe('PRODUCTION_WORKFLOW_SETTINGS', () => {
  it('has expected keys for production settings', () => {
    expect(PRODUCTION_WORKFLOW_SETTINGS).toHaveProperty('saveDataErrorExecution');
    expect(PRODUCTION_WORKFLOW_SETTINGS).toHaveProperty('saveDataSuccessExecution');
    expect(PRODUCTION_WORKFLOW_SETTINGS).toHaveProperty('saveManualExecutions');
    expect(PRODUCTION_WORKFLOW_SETTINGS).toHaveProperty('executionOrder');
    expect(PRODUCTION_WORKFLOW_SETTINGS.saveManualExecutions).toBe(true);
  });
});
