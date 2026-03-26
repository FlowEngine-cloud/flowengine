import { describe, it, expect } from 'vitest';
import { inferConnectionType, normalizeConnectionsForPorts } from '@/lib/n8n/connectionNormalizer';

// ─── inferConnectionType ──────────────────────────────────────────────────────

describe('inferConnectionType', () => {
  it('returns ai_languageModel when a chat model connects to an AI agent', () => {
    expect(inferConnectionType(
      '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      '@n8n/n8n-nodes-langchain.agent'
    )).toBe('ai_languageModel');
  });

  it('returns ai_memory when a memory node connects to an AI agent', () => {
    expect(inferConnectionType(
      '@n8n/n8n-nodes-langchain.memoryBufferWindow',
      '@n8n/n8n-nodes-langchain.agent'
    )).toBe('ai_memory');
  });

  it('returns ai_tool when a tool connects to an AI agent', () => {
    expect(inferConnectionType(
      '@n8n/n8n-nodes-langchain.toolCode',
      '@n8n/n8n-nodes-langchain.agent'
    )).toBe('ai_tool');
  });

  it('returns ai_embedding when an embeddings node connects to a vector store', () => {
    expect(inferConnectionType(
      '@n8n/n8n-nodes-langchain.embeddingsOpenAi',
      '@n8n/n8n-nodes-langchain.vectorStoreSupabase'
    )).toBe('ai_embedding');
  });

  it('returns undefined for two regular action nodes', () => {
    expect(inferConnectionType(
      'n8n-nodes-base.slack',
      'n8n-nodes-base.httpRequest'
    )).toBeUndefined();
  });

  it('returns undefined for trigger to action (main port connections)', () => {
    expect(inferConnectionType(
      'n8n-nodes-base.webhook',
      'n8n-nodes-base.slack'
    )).toBeUndefined();
  });

  it('returns ai_vectorStore when a vector store connects to toolVectorStore', () => {
    expect(inferConnectionType(
      '@n8n/n8n-nodes-langchain.vectorStorePinecone',
      '@n8n/n8n-nodes-langchain.toolVectorStore'
    )).toBe('ai_vectorStore');
  });
});

// ─── normalizeConnectionsForPorts ─────────────────────────────────────────────

describe('normalizeConnectionsForPorts', () => {
  it('returns empty connections when connections is undefined', () => {
    const nodes = [{ name: 'Node1', type: 'n8n-nodes-base.slack' }];
    const result = normalizeConnectionsForPorts(nodes, undefined);
    expect(result.connections).toEqual({});
    expect(result.adjustments).toEqual([]);
  });

  it('returns empty connections for empty connections object', () => {
    const result = normalizeConnectionsForPorts([], {});
    expect(result.connections).toEqual({});
    expect(result.adjustments).toEqual([]);
  });

  it('does not modify main-to-main connections (trigger → action)', () => {
    const nodes = [
      { name: 'Webhook', type: 'n8n-nodes-base.webhook' },
      { name: 'Slack', type: 'n8n-nodes-base.slack' },
    ];
    const connections = {
      Webhook: {
        main: [[{ node: 'Slack', type: 'main', index: 0 }]],
      },
    };

    const result = normalizeConnectionsForPorts(nodes, connections);
    expect(result.adjustments).toHaveLength(0);
    // main connection should be kept
    expect(result.connections.Webhook?.main?.[0]).toHaveLength(1);
    expect(result.connections.Webhook.main[0][0].node).toBe('Slack');
  });

  it('moves chat model from main to ai_languageModel when connecting to agent', () => {
    const nodes = [
      { name: 'ChatModel', type: '@n8n/n8n-nodes-langchain.lmChatOpenAi' },
      { name: 'Agent', type: '@n8n/n8n-nodes-langchain.agent' },
    ];
    const connections = {
      ChatModel: {
        main: [[{ node: 'Agent', type: 'main', index: 0 }]],
      },
    };

    const result = normalizeConnectionsForPorts(nodes, connections);
    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0]).toContain('ai_languageModel');
    // main should be emptied
    expect(result.connections.ChatModel?.main).toBeUndefined();
    // ai_languageModel port should have the connection
    expect(result.connections.ChatModel?.ai_languageModel?.[0]?.[0]?.node).toBe('Agent');
  });

  it('moves memory node from main to ai_memory when connecting to agent', () => {
    const nodes = [
      { name: 'Memory', type: '@n8n/n8n-nodes-langchain.memoryBufferWindow' },
      { name: 'Agent', type: '@n8n/n8n-nodes-langchain.agent' },
    ];
    const connections = {
      Memory: {
        main: [[{ node: 'Agent', type: 'main', index: 0 }]],
      },
    };

    const result = normalizeConnectionsForPorts(nodes, connections);
    expect(result.adjustments).toHaveLength(1);
    expect(result.adjustments[0]).toContain('ai_memory');
    expect(result.connections.Memory?.ai_memory?.[0]?.[0]?.node).toBe('Agent');
  });

  it('does not mutate the original connections object', () => {
    const nodes = [
      { name: 'Memory', type: '@n8n/n8n-nodes-langchain.memoryBufferWindow' },
      { name: 'Agent', type: '@n8n/n8n-nodes-langchain.agent' },
    ];
    const original = {
      Memory: { main: [[{ node: 'Agent', type: 'main', index: 0 }]] },
    };
    const frozen = JSON.parse(JSON.stringify(original));

    normalizeConnectionsForPorts(nodes, original);

    expect(original).toEqual(frozen);
  });

  it('skips connections to unknown nodes (not in nodes list)', () => {
    const nodes = [
      { name: 'Memory', type: '@n8n/n8n-nodes-langchain.memoryBufferWindow' },
    ];
    const connections = {
      Memory: {
        main: [[{ node: 'UnknownNode', type: 'main', index: 0 }]],
      },
    };

    const result = normalizeConnectionsForPorts(nodes, connections);
    // Connection to unknown node should be kept as-is
    expect(result.adjustments).toHaveLength(0);
    expect(result.connections.Memory?.main?.[0]?.[0]?.node).toBe('UnknownNode');
  });

  it('does not add duplicate connections', () => {
    const nodes = [
      { name: 'Memory', type: '@n8n/n8n-nodes-langchain.memoryBufferWindow' },
      { name: 'Agent', type: '@n8n/n8n-nodes-langchain.agent' },
    ];
    // Same connection in two slots
    const connections = {
      Memory: {
        main: [
          [{ node: 'Agent', type: 'main', index: 0 }],
          [{ node: 'Agent', type: 'main', index: 0 }],
        ],
      },
    };

    const result = normalizeConnectionsForPorts(nodes, connections);
    // Should only add once
    expect(result.connections.Memory?.ai_memory?.[0]).toHaveLength(1);
  });
});
