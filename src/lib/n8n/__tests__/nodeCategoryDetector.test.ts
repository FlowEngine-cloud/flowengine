import { describe, it, expect } from 'vitest';
import { detectNodeCategory, getCategoryNodes } from '@/lib/n8n/nodeCategoryDetector';

// ─── detectNodeCategory ───────────────────────────────────────────────────────

describe('detectNodeCategory', () => {
  it('returns trigger for a node with no connections at all (no inputs)', () => {
    const workflow = {
      nodes: [{ name: 'Webhook', type: 'n8n-nodes-base.webhook' }],
      connections: {},
    };
    expect(detectNodeCategory(workflow, 'Webhook')).toBe('trigger');
  });

  it('returns aiModel for a node outputting on ai_languageModel', () => {
    const workflow = {
      nodes: [],
      connections: {
        GPT: { ai_languageModel: [[{ node: 'Agent', type: 'ai_languageModel', index: 0 }]] },
      },
    };
    expect(detectNodeCategory(workflow, 'GPT')).toBe('aiModel');
  });

  it('returns aiMemory for a node outputting on ai_memory', () => {
    const workflow = {
      nodes: [],
      connections: {
        Memory: { ai_memory: [[{ node: 'Agent', type: 'ai_memory', index: 0 }]] },
      },
    };
    expect(detectNodeCategory(workflow, 'Memory')).toBe('aiMemory');
  });

  it('returns aiTool for a node outputting on ai_tool', () => {
    const workflow = {
      nodes: [],
      connections: {
        Tool: { ai_tool: [[{ node: 'Agent', type: 'ai_tool', index: 0 }]] },
      },
    };
    expect(detectNodeCategory(workflow, 'Tool')).toBe('aiTool');
  });

  it('returns aiAgent for the langchain agent node type', () => {
    const workflow = {
      nodes: [{ name: 'Agent', type: '@n8n/n8n-nodes-langchain.agent' }],
      connections: {
        Webhook: { main: [[{ node: 'Agent', type: 'main', index: 0 }]] },
        Agent: { main: [[{ node: 'Respond', type: 'main', index: 0 }]] },
      },
    };
    // Agent has incoming from Webhook and outgoing on main, and is agent type
    expect(detectNodeCategory(workflow, 'Agent')).toBe('aiAgent');
  });

  it('returns trigger for a node with main output but no incoming connections', () => {
    const workflow = {
      nodes: [],
      connections: {
        Webhook: { main: [[{ node: 'Slack', type: 'main', index: 0 }]] },
      },
    };
    expect(detectNodeCategory(workflow, 'Webhook')).toBe('trigger');
  });

  it('returns regular for a node with main output AND incoming connections', () => {
    const workflow = {
      nodes: [],
      connections: {
        Webhook: { main: [[{ node: 'Slack', type: 'main', index: 0 }]] },
        Slack: { main: [[{ node: 'End', type: 'main', index: 0 }]] },
      },
    };
    expect(detectNodeCategory(workflow, 'Slack')).toBe('regular');
  });

  it('returns unknown for a node with only incoming connections (leaf node)', () => {
    const workflow = {
      nodes: [],
      connections: {
        Webhook: { main: [[{ node: 'End', type: 'main', index: 0 }]] },
      },
    };
    // 'End' has incoming but no outgoing
    expect(detectNodeCategory(workflow, 'End')).toBe('unknown');
  });
});

// ─── getCategoryNodes ─────────────────────────────────────────────────────────

describe('getCategoryNodes', () => {
  it('maps each category to the correct registry name', () => {
    expect(getCategoryNodes('trigger')).toBe('triggers');
    expect(getCategoryNodes('regular')).toBe('regularNodes');
    expect(getCategoryNodes('aiTool')).toBe('aiTools');
    expect(getCategoryNodes('aiModel')).toBe('aiModels');
    expect(getCategoryNodes('aiMemory')).toBe('aiMemories');
    expect(getCategoryNodes('aiAgent')).toBe('aiAgents');
  });

  it('defaults to regularNodes for unknown category', () => {
    expect(getCategoryNodes('unknown')).toBe('regularNodes');
  });
});
