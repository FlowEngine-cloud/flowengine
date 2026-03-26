import { describe, it, expect } from 'vitest';
import { completeWorkflow } from '@/lib/n8n/workflowCompleter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AGENT_TYPE = '@n8n/n8n-nodes-langchain.agent';
const LLM_TYPE = 'CUSTOM.flowEngineLlm';

function makeNode(name: string, type: string, id = 'node-1') {
  return {
    parameters: {},
    id,
    name,
    type,
    position: [100, 100] as [number, number],
  };
}

// ─── completeWorkflow ────────────────────────────────────────────────────────

describe('completeWorkflow', () => {
  it('returns empty workflow unchanged', () => {
    const workflow = { nodes: [], connections: {} };
    const { workflow: result, additions } = completeWorkflow(workflow);
    expect(result.nodes).toHaveLength(0);
    expect(additions).toHaveLength(0);
  });

  it('non-composite nodes produce no additions', () => {
    const workflow = {
      nodes: [
        makeNode('Slack', 'n8n-nodes-base.slack', 'n1'),
        makeNode('Trigger', 'n8n-nodes-base.manualTrigger', 'n2'),
      ],
      connections: {},
    };
    const { workflow: result, additions } = completeWorkflow(workflow);
    expect(additions).toHaveLength(0);
    expect(result.nodes).toHaveLength(2);
  });

  it('adds FlowEngine LLM when agent node has no language model', () => {
    const workflow = {
      nodes: [makeNode('AI Agent', AGENT_TYPE, 'agent-1')],
      connections: {},
    };
    const { workflow: result, additions } = completeWorkflow(workflow);
    const llm = result.nodes.find((n) => n.type === LLM_TYPE);
    expect(llm).toBeDefined();
    expect(additions.length).toBeGreaterThan(0);
  });

  it('does NOT add sub-node when agent already has language model', () => {
    const workflow = {
      nodes: [
        makeNode('Flow Engine Llm', LLM_TYPE, 'llm-1'),
        makeNode('AI Agent', AGENT_TYPE, 'agent-1'),
      ],
      connections: {
        'Flow Engine Llm': {
          ai_languageModel: [
            [{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }],
          ],
        },
      },
    };
    const { workflow: result, additions } = completeWorkflow(workflow);
    expect(additions).toHaveLength(0);
    expect(result.nodes).toHaveLength(2);
  });

  it('addition string contains "→ <parentNodeName>"', () => {
    const workflow = {
      nodes: [makeNode('My Agent', AGENT_TYPE, 'agent-x')],
      connections: {},
    };
    const { additions } = completeWorkflow(workflow);
    expect(additions.some((a) => a.includes('→ My Agent'))).toBe(true);
  });

  it('created sub-node gets a non-empty id', () => {
    const workflow = {
      nodes: [makeNode('AI Agent', AGENT_TYPE, 'agent-1')],
      connections: {},
    };
    const { workflow: result } = completeWorkflow(workflow);
    const llm = result.nodes.find((n) => n.type === LLM_TYPE);
    expect(llm?.id).toBeTruthy();
  });

  it('created sub-node gets typeVersion 1 for CUSTOM.flowEngineLlm', () => {
    const workflow = {
      nodes: [makeNode('AI Agent', AGENT_TYPE, 'agent-1')],
      connections: {},
    };
    const { workflow: result } = completeWorkflow(workflow);
    const llm = result.nodes.find((n) => n.type === LLM_TYPE);
    expect(llm?.typeVersion).toBe(1);
  });

  it('creates a connection from sub-node to agent', () => {
    const workflow = {
      nodes: [makeNode('AI Agent', AGENT_TYPE, 'agent-1')],
      connections: {},
    };
    const { workflow: result } = completeWorkflow(workflow);
    const llm = result.nodes.find((n) => n.type === LLM_TYPE);
    expect(llm).toBeDefined();
    const conn = result.connections[llm!.name]?.ai_languageModel?.[0]?.[0];
    expect(conn?.node).toBe('AI Agent');
  });

  it('skips adding node if friendly name already exists in workflow', () => {
    // Pre-place a node with the same name the completer would generate
    const friendlyName = 'Flow Engine Llm'; // generated from 'CUSTOM.flowEngineLlm'
    const workflow = {
      nodes: [
        makeNode(friendlyName, LLM_TYPE, 'llm-existing'),
        makeNode('AI Agent', AGENT_TYPE, 'agent-1'),
      ],
      connections: {},
    };
    const { workflow: result } = completeWorkflow(workflow);
    // Should not add a duplicate — node count stays at 2
    const llmCount = result.nodes.filter((n) => n.name === friendlyName).length;
    expect(llmCount).toBe(1);
  });

  it('does not mutate the original workflow', () => {
    const workflow = {
      nodes: [makeNode('AI Agent', AGENT_TYPE, 'agent-1')],
      connections: {},
    };
    const original = JSON.stringify(workflow);
    completeWorkflow(workflow);
    expect(JSON.stringify(workflow)).toBe(original);
  });
});
