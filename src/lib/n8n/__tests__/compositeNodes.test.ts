import { describe, it, expect } from 'vitest';
import { isCompositeNode, getCompositeTemplate } from '@/lib/n8n/compositeNodes';

// ─── isCompositeNode ──────────────────────────────────────────────────────────

describe('isCompositeNode', () => {
  it('returns true for the AI agent node', () => {
    expect(isCompositeNode('@n8n/n8n-nodes-langchain.agent')).toBe(true);
  });

  it('returns false for a regular non-composite node', () => {
    expect(isCompositeNode('n8n-nodes-base.slack')).toBe(false);
  });

  it('returns false for manualTrigger', () => {
    expect(isCompositeNode('n8n-nodes-base.manualTrigger')).toBe(false);
  });

  it('returns false for an unknown / made-up node type', () => {
    expect(isCompositeNode('xyz.unknownFakeNode999')).toBe(false);
  });

  it('returns false for lmChat nodes (they are sub-nodes, not composite)', () => {
    expect(isCompositeNode('CUSTOM.flowEngineLlm')).toBe(false);
  });
});

// ─── getCompositeTemplate ────────────────────────────────────────────────────

describe('getCompositeTemplate', () => {
  it('returns null for a regular non-composite node', () => {
    expect(getCompositeTemplate('n8n-nodes-base.slack')).toBeNull();
  });

  it('returns null for an unknown node type', () => {
    expect(getCompositeTemplate('xyz.totallyFakeNode')).toBeNull();
  });

  it('returns a template for the AI agent node', () => {
    const template = getCompositeTemplate('@n8n/n8n-nodes-langchain.agent');
    expect(template).not.toBeNull();
    expect(template!.nodeType).toBe('@n8n/n8n-nodes-langchain.agent');
  });

  it('agent template requires ai_languageModel', () => {
    const template = getCompositeTemplate('@n8n/n8n-nodes-langchain.agent');
    const hasLM = template!.requiredConnections.some(
      (c) => c.connectionType === 'ai_languageModel'
    );
    expect(hasLM).toBe(true);
  });

  it('agent ai_languageModel connection is marked isRequired: true', () => {
    const template = getCompositeTemplate('@n8n/n8n-nodes-langchain.agent');
    const lmReq = template!.requiredConnections.find(
      (c) => c.connectionType === 'ai_languageModel'
    );
    expect(lmReq?.isRequired).toBe(true);
  });

  it('agent default sub-node is CUSTOM.flowEngineLlm', () => {
    const template = getCompositeTemplate('@n8n/n8n-nodes-langchain.agent');
    const lmDefault = template!.defaultSubNodes?.find(
      (s) => s.connectionType === 'ai_languageModel'
    );
    expect(lmDefault?.nodeType).toBe('CUSTOM.flowEngineLlm');
  });

  it('agent default sub-node carries openai/gpt-5-nano parameters', () => {
    const template = getCompositeTemplate('@n8n/n8n-nodes-langchain.agent');
    const lmDefault = template!.defaultSubNodes?.find(
      (s) => s.connectionType === 'ai_languageModel'
    );
    expect(lmDefault?.parameters?.provider).toBe('openai');
    expect(lmDefault?.parameters?.model).toBe('gpt-5-nano');
  });
});
