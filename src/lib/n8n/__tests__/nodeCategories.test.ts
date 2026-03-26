import { describe, it, expect } from 'vitest';
import {
  NodeCategory,
  categorizeNode,
  getRequiredSubNodes,
  getAllSubNodes,
  getNodePattern,
  isValidNodeType,
} from '@/lib/n8n/nodeCategories';

// ─── categorizeNode ────────────────────────────────────────────────────────────

describe('categorizeNode', () => {
  it('identifies the AI agent node', () => {
    expect(categorizeNode('@n8n/n8n-nodes-langchain.agent')).toBe(NodeCategory.AI_AGENT);
  });

  it('identifies chat model nodes by .lmChat prefix', () => {
    expect(categorizeNode('@n8n/n8n-nodes-langchain.lmChatOpenAi')).toBe(NodeCategory.AI_CHAT_MODEL);
    expect(categorizeNode('@n8n/n8n-nodes-langchain.lmChatAnthropic')).toBe(NodeCategory.AI_CHAT_MODEL);
  });

  it('identifies memory nodes by .memory prefix', () => {
    expect(categorizeNode('@n8n/n8n-nodes-langchain.memoryBufferWindow')).toBe(NodeCategory.AI_MEMORY);
  });

  it('identifies embeddings nodes', () => {
    expect(categorizeNode('@n8n/n8n-nodes-langchain.embeddingsOpenAi')).toBe(NodeCategory.EMBEDDINGS);
  });

  it('identifies vectorStore nodes (not tool variants)', () => {
    expect(categorizeNode('@n8n/n8n-nodes-langchain.vectorStoreSupabase')).toBe(NodeCategory.VECTOR_STORE);
    expect(categorizeNode('@n8n/n8n-nodes-langchain.vectorStorePinecone')).toBe(NodeCategory.VECTOR_STORE);
  });

  it('identifies tool nodes', () => {
    expect(categorizeNode('@n8n/n8n-nodes-langchain.toolCode')).toBe(NodeCategory.TOOL);
    expect(categorizeNode('@n8n/n8n-nodes-langchain.toolCalculator')).toBe(NodeCategory.TOOL);
    expect(categorizeNode('@n8n/n8n-nodes-langchain.toolVectorStore')).toBe(NodeCategory.TOOL);
  });

  it('identifies trigger nodes', () => {
    expect(categorizeNode('n8n-nodes-base.webhook')).toBe(NodeCategory.TRIGGER);
    expect(categorizeNode('n8n-nodes-base.manualTrigger')).toBe(NodeCategory.TRIGGER);
    expect(categorizeNode('@n8n/n8n-nodes-langchain.manualChatTrigger')).toBe(NodeCategory.TRIGGER);
  });

  it('identifies flow control nodes', () => {
    expect(categorizeNode('n8n-nodes-base.if')).toBe(NodeCategory.FLOW_CONTROL);
    expect(categorizeNode('n8n-nodes-base.switch')).toBe(NodeCategory.FLOW_CONTROL);
    expect(categorizeNode('n8n-nodes-base.merge')).toBe(NodeCategory.FLOW_CONTROL);
  });

  it('defaults to ACTION for regular service nodes', () => {
    expect(categorizeNode('n8n-nodes-base.slack')).toBe(NodeCategory.ACTION);
    expect(categorizeNode('n8n-nodes-base.httpRequest')).toBe(NodeCategory.ACTION);
    expect(categorizeNode('n8n-nodes-base.gmail')).toBe(NodeCategory.ACTION);
  });
});

// ─── getRequiredSubNodes ──────────────────────────────────────────────────────

describe('getRequiredSubNodes', () => {
  it('returns model + memory requirements for AI agent', () => {
    const reqs = getRequiredSubNodes('@n8n/n8n-nodes-langchain.agent');
    expect(reqs).toHaveLength(2);
    expect(reqs.find(r => r.connection === 'ai_languageModel')).toBeDefined();
    expect(reqs.find(r => r.connection === 'ai_memory')).toBeDefined();
  });

  it('returns vector store requirement for toolVectorStore', () => {
    const reqs = getRequiredSubNodes('@n8n/n8n-nodes-langchain.toolVectorStore');
    expect(reqs).toHaveLength(1);
    expect(reqs[0].connection).toBe('ai_vectorStore');
    expect(reqs[0].required).toBe(true);
  });

  it('returns AI agent requirement for agentTool', () => {
    const reqs = getRequiredSubNodes('@n8n/n8n-nodes-langchain.agentTool');
    expect(reqs).toHaveLength(1);
    expect(reqs[0].connection).toBe('ai_agent');
  });

  it('returns embeddings requirement for vectorStore nodes', () => {
    const reqs = getRequiredSubNodes('@n8n/n8n-nodes-langchain.vectorStoreSupabase');
    expect(reqs).toHaveLength(1);
    expect(reqs[0].connection).toBe('ai_embedding');
  });

  it('returns language model requirement for chain nodes', () => {
    const reqs = getRequiredSubNodes('@n8n/n8n-nodes-langchain.chainLlm');
    expect(reqs).toHaveLength(1);
    expect(reqs[0].connection).toBe('ai_languageModel');
  });

  it('returns vector store requirement for retriever nodes', () => {
    const reqs = getRequiredSubNodes('@n8n/n8n-nodes-langchain.retrieverVectorStore');
    expect(reqs).toHaveLength(1);
    expect(reqs[0].connection).toBe('ai_vectorStore');
  });

  it('returns empty array for regular action nodes', () => {
    expect(getRequiredSubNodes('n8n-nodes-base.slack')).toHaveLength(0);
    expect(getRequiredSubNodes('n8n-nodes-base.httpRequest')).toHaveLength(0);
  });
});

// ─── getAllSubNodes ────────────────────────────────────────────────────────────

describe('getAllSubNodes', () => {
  it('returns sub-node patterns from the node pattern (including optional)', () => {
    // AI_AGENT pattern has Model (required) + Memory (required) + Tool (optional)
    const subs = getAllSubNodes('@n8n/n8n-nodes-langchain.agent');
    expect(subs.length).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array for ACTION nodes which have no sub-node patterns', () => {
    const subs = getAllSubNodes('n8n-nodes-base.slack');
    expect(subs).toEqual([]);
  });
});

// ─── getNodePattern ────────────────────────────────────────────────────────────

describe('getNodePattern', () => {
  it('returns AI_AGENT pattern for agent node', () => {
    const pattern = getNodePattern('@n8n/n8n-nodes-langchain.agent');
    expect(pattern.category).toBe(NodeCategory.AI_AGENT);
    expect(pattern.requiresSubNodes).toBe(true);
    expect(pattern.connectionTypes).toContain('ai_languageModel');
  });

  it('returns TRIGGER pattern for webhook', () => {
    const pattern = getNodePattern('n8n-nodes-base.webhook');
    expect(pattern.category).toBe(NodeCategory.TRIGGER);
    expect(pattern.requiresSubNodes).toBe(false);
    expect(pattern.connectionTypes).toContain('main');
  });

  it('returns TOOL pattern for tool nodes', () => {
    const pattern = getNodePattern('@n8n/n8n-nodes-langchain.toolCode');
    expect(pattern.category).toBe(NodeCategory.TOOL);
    expect(pattern.connectionTypes).toContain('ai_tool');
  });

  it('returns EMBEDDINGS pattern for embedding nodes', () => {
    const pattern = getNodePattern('@n8n/n8n-nodes-langchain.embeddingsOpenAi');
    expect(pattern.category).toBe(NodeCategory.EMBEDDINGS);
    expect(pattern.connectionTypes).toContain('ai_embedding');
  });
});

// ─── isValidNodeType ──────────────────────────────────────────────────────────

describe('isValidNodeType', () => {
  it('returns true for known nodes', () => {
    expect(isValidNodeType('n8n-nodes-base.slack')).toBe(true);
    expect(isValidNodeType('@n8n/n8n-nodes-langchain.agent')).toBe(true);
  });

  it('returns false for unknown node types', () => {
    expect(isValidNodeType('n8n-nodes-base.notARealNode')).toBe(false);
    expect(isValidNodeType('fake.node')).toBe(false);
    expect(isValidNodeType('')).toBe(false);
  });
});
