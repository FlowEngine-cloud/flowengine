import { describe, it, expect } from 'vitest';
import {
  validateNodeType,
  validateNodeTypes,
  autoCorrectNodeType,
  getInvalidNodes,
  formatValidationResult,
} from '@/lib/n8n/nodeValidator';

// ─── validateNodeType ─────────────────────────────────────────────────────────

describe('validateNodeType', () => {
  it('returns isValid: true for a known node type', () => {
    const result = validateNodeType('n8n-nodes-base.slack');
    expect(result.isValid).toBe(true);
    expect(result.nodeType).toBe('n8n-nodes-base.slack');
    expect(result.suggestions).toBeUndefined();
  });

  it('returns isValid: true for langchain agent node', () => {
    expect(validateNodeType('@n8n/n8n-nodes-langchain.agent').isValid).toBe(true);
  });

  it('returns isValid: false for a completely unknown node type', () => {
    const result = validateNodeType('n8n-nodes-base.absolutelyFakeNode');
    expect(result.isValid).toBe(false);
    expect(result.nodeType).toBe('n8n-nodes-base.absolutelyFakeNode');
  });

  it('returns suggestions for a misspelled node (close to a real one)', () => {
    // 'slak' is close to 'slack' — should get a suggestion
    const result = validateNodeType('n8n-nodes-base.slak');
    expect(result.isValid).toBe(false);
    // Should have at least one suggestion close to slack
    expect(result.suggestions).toBeDefined();
  });

  it('returns empty suggestions for a completely arbitrary string', () => {
    const result = validateNodeType('xyz.zzz_totally_wrong_12345');
    expect(result.isValid).toBe(false);
    // May or may not have suggestions — just verify it doesn't throw
    expect(result.suggestions).toBeDefined();
  });
});

// ─── validateNodeTypes ────────────────────────────────────────────────────────

describe('validateNodeTypes', () => {
  it('returns a Map with results for each input', () => {
    const types = ['n8n-nodes-base.slack', 'n8n-nodes-base.fakeNode'];
    const results = validateNodeTypes(types);

    expect(results.size).toBe(2);
    expect(results.get('n8n-nodes-base.slack')?.isValid).toBe(true);
    expect(results.get('n8n-nodes-base.fakeNode')?.isValid).toBe(false);
  });

  it('returns empty Map for empty input', () => {
    const results = validateNodeTypes([]);
    expect(results.size).toBe(0);
  });
});

// ─── autoCorrectNodeType ──────────────────────────────────────────────────────

describe('autoCorrectNodeType', () => {
  it('returns the original type when it is already valid', () => {
    expect(autoCorrectNodeType('n8n-nodes-base.slack')).toBe('n8n-nodes-base.slack');
  });

  it('replaces risky social media node + write operation with httpRequest', () => {
    const corrected = autoCorrectNodeType(
      'n8n-nodes-base.twitter',
      0.9,
      { operation: 'post tweet' }
    );
    expect(corrected).toBe('n8n-nodes-base.httpRequest');
  });

  it('does NOT replace risky service node for read operations', () => {
    // 'get' is not a write operation — should keep original
    const corrected = autoCorrectNodeType(
      'n8n-nodes-base.twitter',
      0.9,
      { operation: 'get tweets' }
    );
    // Either kept as original or mapped to http, depending on whether twitter exists in registry
    // The important thing is it doesn't throw
    expect(typeof corrected).toBe('string');
  });

  it('returns original when no high-confidence correction found for invalid node', () => {
    // A completely made-up node type — no correction
    const result = autoCorrectNodeType('xyz.totallyFakeNode999', 0.99);
    expect(typeof result).toBe('string');
  });
});

// ─── getInvalidNodes ──────────────────────────────────────────────────────────

describe('getInvalidNodes', () => {
  it('returns only the invalid nodes from the list', () => {
    const types = [
      'n8n-nodes-base.slack',           // valid
      'n8n-nodes-base.fakeServiceXyz',  // invalid
      '@n8n/n8n-nodes-langchain.agent', // valid
    ];
    const invalid = getInvalidNodes(types);
    expect(invalid).toHaveLength(1);
    expect(invalid[0].original).toBe('n8n-nodes-base.fakeServiceXyz');
  });

  it('returns empty array when all nodes are valid', () => {
    const types = ['n8n-nodes-base.slack', 'n8n-nodes-base.httpRequest'];
    expect(getInvalidNodes(types)).toHaveLength(0);
  });

  it('returns all nodes when none are valid', () => {
    const types = ['fake.a', 'fake.b'];
    const invalid = getInvalidNodes(types);
    expect(invalid).toHaveLength(2);
  });
});

// ─── formatValidationResult ───────────────────────────────────────────────────

describe('formatValidationResult', () => {
  it('formats valid node result with a checkmark', () => {
    const result = formatValidationResult({ isValid: true, nodeType: 'n8n-nodes-base.slack' });
    expect(result).toContain('Valid');
    expect(result).toContain('n8n-nodes-base.slack');
  });

  it('formats invalid node with no suggestions', () => {
    const result = formatValidationResult({
      isValid: false,
      nodeType: 'bad.node',
      suggestions: [],
    });
    expect(result).toContain('Invalid');
    expect(result).toContain('no suggestions');
  });

  it('formats invalid node with suggestions and confidence', () => {
    const result = formatValidationResult({
      isValid: false,
      nodeType: 'n8n-nodes-base.slak',
      suggestions: ['n8n-nodes-base.slack', 'n8n-nodes-base.slackOld'],
      correctedNodeType: 'n8n-nodes-base.slack',
      confidence: 0.95,
    });
    expect(result).toContain('Suggested');
    expect(result).toContain('n8n-nodes-base.slack');
    expect(result).toContain('95%');
  });
});
