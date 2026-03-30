import { describe, it, expect } from 'vitest';
import {
  getPortCapabilities,
  canOutputOnPort,
  canAcceptInputOnPort,
  getValidOutputPorts,
  getValidInputPorts,
  isAIPort,
  AI_PORT_TYPES,
} from '@/lib/n8n/portCapabilities';

// ─── getPortCapabilities ──────────────────────────────────────────────────────

describe('getPortCapabilities', () => {
  it('returns exact capabilities for explicitly defined nodes', () => {
    const caps = getPortCapabilities('@n8n/n8n-nodes-langchain.agent');
    expect(caps.outputs).toContain('main');
    expect(caps.inputs).toContain('ai_languageModel');
    expect(caps.inputs).toContain('ai_memory');
    expect(caps.inputs).toContain('ai_tool');
  });

  it('chat model outputs ai_languageModel only', () => {
    const caps = getPortCapabilities('@n8n/n8n-nodes-langchain.lmChatOpenAi');
    expect(caps.outputs).toEqual(['ai_languageModel']);
    expect(caps.inputs).toHaveLength(0);
  });

  it('memory node outputs ai_memory only', () => {
    const caps = getPortCapabilities('@n8n/n8n-nodes-langchain.memoryBufferWindow');
    expect(caps.outputs).toEqual(['ai_memory']);
    expect(caps.inputs).toHaveLength(0);
  });

  it('patterns: n8n-nodes-base.*Tool nodes output ai_tool', () => {
    const caps = getPortCapabilities('n8n-nodes-base.gmailTool');
    expect(caps.outputs).toContain('ai_tool');
    expect(caps.inputs).toHaveLength(0);
  });

  it('patterns: regular n8n-nodes-base service nodes use main', () => {
    const caps = getPortCapabilities('n8n-nodes-base.slack');
    expect(caps.outputs).toContain('main');
    expect(caps.inputs).toContain('main');
  });

  it('returns default main in/out for unknown node types', () => {
    const caps = getPortCapabilities('unknown.custom.node');
    expect(caps.outputs).toContain('main');
    expect(caps.inputs).toContain('main');
  });

  it('webhook trigger has no inputs', () => {
    const caps = getPortCapabilities('n8n-nodes-base.webhook');
    expect(caps.inputs).toHaveLength(0);
    expect(caps.outputs).toContain('main');
  });
});

// ─── canOutputOnPort ──────────────────────────────────────────────────────────

describe('canOutputOnPort', () => {
  it('returns true when node can output on the given port', () => {
    expect(canOutputOnPort('@n8n/n8n-nodes-langchain.lmChatOpenAi', 'ai_languageModel')).toBe(true);
    expect(canOutputOnPort('@n8n/n8n-nodes-langchain.agent', 'main')).toBe(true);
    expect(canOutputOnPort('@n8n/n8n-nodes-langchain.toolCode', 'ai_tool')).toBe(true);
  });

  it('returns false when node cannot output on the given port', () => {
    expect(canOutputOnPort('@n8n/n8n-nodes-langchain.lmChatOpenAi', 'main')).toBe(false);
    expect(canOutputOnPort('@n8n/n8n-nodes-langchain.agent', 'ai_languageModel')).toBe(false);
  });
});

// ─── canAcceptInputOnPort ─────────────────────────────────────────────────────

describe('canAcceptInputOnPort', () => {
  it('returns true when node accepts input on the given port', () => {
    expect(canAcceptInputOnPort('@n8n/n8n-nodes-langchain.agent', 'ai_languageModel')).toBe(true);
    expect(canAcceptInputOnPort('@n8n/n8n-nodes-langchain.agent', 'ai_memory')).toBe(true);
    expect(canAcceptInputOnPort('n8n-nodes-base.httpRequest', 'main')).toBe(true);
  });

  it('returns false when node does not accept the given port', () => {
    expect(canAcceptInputOnPort('@n8n/n8n-nodes-langchain.lmChatOpenAi', 'ai_languageModel')).toBe(false);
    expect(canAcceptInputOnPort('n8n-nodes-base.webhook', 'main')).toBe(false);
  });
});

// ─── getValidOutputPorts ──────────────────────────────────────────────────────

describe('getValidOutputPorts', () => {
  it('returns correct output ports for known nodes', () => {
    expect(getValidOutputPorts('@n8n/n8n-nodes-langchain.embeddingsOpenAi')).toEqual(['ai_embedding']);
    expect(getValidOutputPorts('@n8n/n8n-nodes-langchain.memoryBufferWindow')).toEqual(['ai_memory']);
  });
});

// ─── getValidInputPorts ───────────────────────────────────────────────────────

describe('getValidInputPorts', () => {
  it('returns input ports for vector store nodes', () => {
    const inputs = getValidInputPorts('@n8n/n8n-nodes-langchain.vectorStoreSupabase');
    expect(inputs).toContain('ai_embedding');
    expect(inputs).toContain('ai_document');
  });

  it('returns empty array for trigger nodes', () => {
    expect(getValidInputPorts('n8n-nodes-base.manualTrigger')).toHaveLength(0);
  });
});

// ─── isAIPort ─────────────────────────────────────────────────────────────────

describe('isAIPort', () => {
  it('returns true for all AI port types', () => {
    AI_PORT_TYPES.forEach(port => {
      expect(isAIPort(port)).toBe(true);
    });
  });

  it('returns false for main port', () => {
    expect(isAIPort('main')).toBe(false);
  });

  it('returns false for unknown port types', () => {
    expect(isAIPort('unknown_port')).toBe(false);
    expect(isAIPort('')).toBe(false);
  });
});
