import { describe, it, expect } from 'vitest';
import {
  isDeprecatedNode,
  getModernReplacement,
  isChatModelNode,
  isAIAgentNode,
  isMemoryNode,
  isToolNode,
  getSuggestedNodeName,
  getAIAgentRequirementsText,
  DEPRECATED_NODES,
  MODERN_NODES,
} from '@/lib/n8n/nodeTypeMapping';

// ─── isDeprecatedNode ─────────────────────────────────────────────────────────

describe('isDeprecatedNode', () => {
  it('returns true for the deprecated OpenAI node', () => {
    expect(isDeprecatedNode(DEPRECATED_NODES.OLD_OPENAI_LLM)).toBe(true);
    expect(isDeprecatedNode('@n8n/n8n-nodes-langchain.openAi')).toBe(true);
  });

  it('returns false for modern nodes', () => {
    expect(isDeprecatedNode(MODERN_NODES.OPENAI_CHAT_MODEL)).toBe(false);
    expect(isDeprecatedNode(MODERN_NODES.AI_AGENT)).toBe(false);
    expect(isDeprecatedNode('n8n-nodes-base.slack')).toBe(false);
  });
});

// ─── getModernReplacement ─────────────────────────────────────────────────────

describe('getModernReplacement', () => {
  it('returns the modern chat model for the deprecated OpenAI node', () => {
    expect(getModernReplacement(DEPRECATED_NODES.OLD_OPENAI_LLM)).toBe(MODERN_NODES.OPENAI_CHAT_MODEL);
  });

  it('handles the common variation without @n8n/ prefix', () => {
    expect(getModernReplacement('n8n-nodes-langchain.openAi')).toBe(MODERN_NODES.OPENAI_CHAT_MODEL);
  });

  it('returns null for node types not in the replacement map', () => {
    expect(getModernReplacement('n8n-nodes-base.slack')).toBeNull();
    expect(getModernReplacement('unknown.node')).toBeNull();
  });
});

// ─── isChatModelNode ──────────────────────────────────────────────────────────

describe('isChatModelNode', () => {
  it('returns true for all modern chat model types', () => {
    expect(isChatModelNode(MODERN_NODES.OPENAI_CHAT_MODEL)).toBe(true);
    expect(isChatModelNode(MODERN_NODES.ANTHROPIC_CHAT_MODEL)).toBe(true);
    expect(isChatModelNode(MODERN_NODES.GOOGLE_GEMINI_CHAT_MODEL)).toBe(true);
    expect(isChatModelNode(MODERN_NODES.FLOWENGINE_LLM)).toBe(true);
  });

  it('returns true for custom CUSTOM. prefix nodes', () => {
    expect(isChatModelNode('CUSTOM.myCustomModel')).toBe(true);
  });

  it('returns false for non-chat-model nodes', () => {
    expect(isChatModelNode(MODERN_NODES.AI_AGENT)).toBe(false);
    expect(isChatModelNode('n8n-nodes-base.slack')).toBe(false);
    expect(isChatModelNode(MODERN_NODES.MEMORY_BUFFER_WINDOW)).toBe(false);
  });
});

// ─── isAIAgentNode ────────────────────────────────────────────────────────────

describe('isAIAgentNode', () => {
  it('returns true only for the exact AI agent node type', () => {
    expect(isAIAgentNode(MODERN_NODES.AI_AGENT)).toBe(true);
    expect(isAIAgentNode('@n8n/n8n-nodes-langchain.agent')).toBe(true);
  });

  it('returns false for other node types', () => {
    expect(isAIAgentNode(MODERN_NODES.OPENAI_CHAT_MODEL)).toBe(false);
    expect(isAIAgentNode(MODERN_NODES.CODE_TOOL)).toBe(false);
    expect(isAIAgentNode('n8n-nodes-base.slack')).toBe(false);
  });
});

// ─── isMemoryNode ─────────────────────────────────────────────────────────────

describe('isMemoryNode', () => {
  it('returns true for all memory node types', () => {
    expect(isMemoryNode(MODERN_NODES.MEMORY_BUFFER_WINDOW)).toBe(true);
    expect(isMemoryNode(MODERN_NODES.MEMORY_CHAT)).toBe(true);
    expect(isMemoryNode(MODERN_NODES.MEMORY_REDIS)).toBe(true);
  });

  it('returns false for non-memory nodes', () => {
    expect(isMemoryNode(MODERN_NODES.AI_AGENT)).toBe(false);
    expect(isMemoryNode(MODERN_NODES.OPENAI_CHAT_MODEL)).toBe(false);
    expect(isMemoryNode('n8n-nodes-base.slack')).toBe(false);
  });
});

// ─── isToolNode ───────────────────────────────────────────────────────────────

describe('isToolNode', () => {
  it('returns true for all tool node types', () => {
    expect(isToolNode(MODERN_NODES.CODE_TOOL)).toBe(true);
    expect(isToolNode(MODERN_NODES.HTTP_REQUEST_TOOL)).toBe(true);
    expect(isToolNode(MODERN_NODES.CALCULATOR_TOOL)).toBe(true);
  });

  it('returns false for non-tool nodes', () => {
    expect(isToolNode(MODERN_NODES.AI_AGENT)).toBe(false);
    expect(isToolNode(MODERN_NODES.MEMORY_BUFFER_WINDOW)).toBe(false);
    expect(isToolNode('n8n-nodes-base.slack')).toBe(false);
  });
});

// ─── getSuggestedNodeName ─────────────────────────────────────────────────────

describe('getSuggestedNodeName', () => {
  it('returns human-readable names for known node types', () => {
    expect(getSuggestedNodeName(MODERN_NODES.OPENAI_CHAT_MODEL)).toBe('OpenAI Chat Model');
    expect(getSuggestedNodeName(MODERN_NODES.ANTHROPIC_CHAT_MODEL)).toBe('Anthropic Chat Model');
    expect(getSuggestedNodeName(MODERN_NODES.AI_AGENT)).toBe('AI Agent');
    expect(getSuggestedNodeName(MODERN_NODES.MEMORY_BUFFER_WINDOW)).toBe('Simple Memory');
    expect(getSuggestedNodeName(MODERN_NODES.CODE_TOOL)).toBe('Code Tool');
  });

  it('returns "Node" for unknown types', () => {
    expect(getSuggestedNodeName('n8n-nodes-base.slack')).toBe('Node');
    expect(getSuggestedNodeName('unknown.type')).toBe('Node');
    expect(getSuggestedNodeName('')).toBe('Node');
  });
});

// ─── getAIAgentRequirementsText ───────────────────────────────────────────────

describe('getAIAgentRequirementsText', () => {
  it('returns a non-empty string', () => {
    const text = getAIAgentRequirementsText();
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(0);
  });

  it('mentions required connection types', () => {
    const text = getAIAgentRequirementsText();
    expect(text).toContain('ai_languageModel');
    expect(text).toContain('ai_memory');
    expect(text).toContain('ai_tool');
  });
});
