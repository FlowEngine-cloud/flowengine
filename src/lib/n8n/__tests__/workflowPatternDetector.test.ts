import { describe, it, expect } from 'vitest';
import {
  detectWorkflowPattern,
  getPatternDescription,
  getPatternRules,
  WorkflowPattern,
} from '@/lib/n8n/workflowPatternDetector';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AI_AGENT = '@n8n/n8n-nodes-langchain.agent';

function makeNode(name: string, type: string, id?: string) {
  return { id: id ?? name, name, type, parameters: {} };
}

function makeTriggerNode(name = 'Start', id?: string) {
  return makeNode(name, 'n8n-nodes-base.manualTrigger', id);
}

function makeAgentNode(name: string, id?: string) {
  return makeNode(name, AI_AGENT, id);
}

// Build connections object for a linear chain A → B → C...
function chainConnections(nodes: Array<{ id: string }>) {
  const connections: Record<string, any> = {};
  for (let i = 0; i < nodes.length - 1; i++) {
    connections[nodes[i].id] = {
      main: [[{ node: nodes[i + 1].id, type: 'main', index: 0 }]],
    };
  }
  return connections;
}

// ─── detectWorkflowPattern ────────────────────────────────────────────────────

describe('detectWorkflowPattern', () => {
  it('returns REGULAR_WORKFLOW when there are no nodes', () => {
    const ctx = detectWorkflowPattern({ nodes: [], connections: {} });
    expect(ctx.pattern).toBe(WorkflowPattern.REGULAR_WORKFLOW);
    expect(ctx.agentCount).toBe(0);
  });

  it('returns REGULAR_WORKFLOW when there are only non-agent nodes', () => {
    const ctx = detectWorkflowPattern({
      nodes: [
        makeTriggerNode(),
        makeNode('HTTP', 'n8n-nodes-base.httpRequest'),
      ],
      connections: {},
    });
    expect(ctx.pattern).toBe(WorkflowPattern.REGULAR_WORKFLOW);
    expect(ctx.agentCount).toBe(0);
    expect(ctx.agents).toHaveLength(0);
  });

  it('returns SINGLE_AGENT for a workflow with exactly one agent', () => {
    const ctx = detectWorkflowPattern({
      nodes: [makeTriggerNode(), makeAgentNode('Agent1')],
      connections: {},
    });
    expect(ctx.pattern).toBe(WorkflowPattern.SINGLE_AGENT);
    expect(ctx.agentCount).toBe(1);
    expect(ctx.agents).toHaveLength(1);
    expect(ctx.agents[0].name).toBe('Agent1');
  });

  it('returns MULTI_AGENT_SEQUENTIAL for two agents chained together', () => {
    const agent1 = makeAgentNode('Agent1', 'node-1');
    const agent2 = makeAgentNode('Agent2', 'node-2');
    const ctx = detectWorkflowPattern({
      nodes: [agent1, agent2],
      connections: chainConnections([{ id: 'node-1' }, { id: 'node-2' }]),
    });
    expect(ctx.pattern).toBe(WorkflowPattern.MULTI_AGENT_SEQUENTIAL);
    expect(ctx.agentCount).toBe(2);
  });

  it('returns MIXED for two agents with no connections between them', () => {
    const ctx = detectWorkflowPattern({
      nodes: [makeAgentNode('Agent1', 'a1'), makeAgentNode('Agent2', 'a2')],
      connections: {}, // no chain
    });
    expect(ctx.pattern).toBe(WorkflowPattern.MIXED);
  });

  it('returns MIXED for three agents where chain is incomplete', () => {
    // A → B only; C is disconnected — chain is broken
    const a = makeAgentNode('A', 'a');
    const b = makeAgentNode('B', 'b');
    const c = makeAgentNode('C', 'c');
    const ctx = detectWorkflowPattern({
      nodes: [a, b, c],
      connections: chainConnections([{ id: 'a' }, { id: 'b' }]),
    });
    // 3 agents, only 1 chain link (need ≥ 2) → MIXED
    expect(ctx.pattern).toBe(WorkflowPattern.MIXED);
  });

  it('returns MULTI_AGENT_SEQUENTIAL for three fully chained agents', () => {
    const nodes = [
      makeAgentNode('A', 'a'),
      makeAgentNode('B', 'b'),
      makeAgentNode('C', 'c'),
    ];
    const ctx = detectWorkflowPattern({
      nodes,
      connections: chainConnections(nodes.map(n => ({ id: n.id! }))),
    });
    expect(ctx.pattern).toBe(WorkflowPattern.MULTI_AGENT_SEQUENTIAL);
    expect(ctx.agentCount).toBe(3);
  });

  it('detects the trigger node', () => {
    const trigger = makeTriggerNode('My Trigger', 'trig-1');
    const ctx = detectWorkflowPattern({
      nodes: [trigger, makeAgentNode('Agent')],
      connections: {},
    });
    expect(ctx.trigger).toMatchObject({ name: 'My Trigger', type: 'n8n-nodes-base.manualTrigger' });
  });

  it('returns no trigger when workflow has none', () => {
    const ctx = detectWorkflowPattern({
      nodes: [makeAgentNode('Agent')],
      connections: {},
    });
    expect(ctx.trigger).toBeUndefined();
  });

  it('handles null/undefined workflow gracefully', () => {
    const ctx = detectWorkflowPattern({ nodes: null, connections: null });
    expect(ctx.pattern).toBe(WorkflowPattern.REGULAR_WORKFLOW);
  });
});

// ─── getPatternDescription ────────────────────────────────────────────────────

describe('getPatternDescription', () => {
  it('returns a string for each pattern', () => {
    const patterns = Object.values(WorkflowPattern);
    for (const pattern of patterns) {
      const desc = getPatternDescription(pattern);
      expect(typeof desc).toBe('string');
      expect(desc.length).toBeGreaterThan(0);
    }
  });

  it('returns distinct descriptions for each pattern', () => {
    const descriptions = Object.values(WorkflowPattern).map(getPatternDescription);
    const unique = new Set(descriptions);
    expect(unique.size).toBe(descriptions.length);
  });

  it('returns "Unknown pattern" for unrecognized pattern values', () => {
    expect(getPatternDescription('not_a_real_pattern' as WorkflowPattern)).toBe('Unknown pattern');
  });
});

// ─── getPatternRules ──────────────────────────────────────────────────────────

describe('getPatternRules', () => {
  it('SINGLE_AGENT requires model and memory but no multiple agents', () => {
    const rules = getPatternRules(WorkflowPattern.SINGLE_AGENT);
    expect(rules.requiresModel).toBe(true);
    expect(rules.requiresMemory).toBe(true);
    expect(rules.allowsMultipleAgents).toBe(false);
    expect(rules.requiresToolAgents).toBe(false);
  });

  it('MULTI_AGENT_SEQUENTIAL allows multiple agents', () => {
    const rules = getPatternRules(WorkflowPattern.MULTI_AGENT_SEQUENTIAL);
    expect(rules.allowsMultipleAgents).toBe(true);
    expect(rules.requiresModel).toBe(true);
  });

  it('REGULAR_WORKFLOW does not require model or memory', () => {
    const rules = getPatternRules(WorkflowPattern.REGULAR_WORKFLOW);
    expect(rules.requiresModel).toBe(false);
    expect(rules.requiresMemory).toBe(false);
  });

  it('MIXED uses default rules (no model/memory required)', () => {
    const rules = getPatternRules(WorkflowPattern.MIXED);
    expect(rules.requiresModel).toBe(false);
    expect(rules.allowsMultipleAgents).toBe(true);
  });

  it('returns an object with all 4 rule keys', () => {
    const rules = getPatternRules(WorkflowPattern.SINGLE_AGENT);
    expect(rules).toHaveProperty('requiresModel');
    expect(rules).toHaveProperty('requiresMemory');
    expect(rules).toHaveProperty('allowsMultipleAgents');
    expect(rules).toHaveProperty('requiresToolAgents');
  });
});
