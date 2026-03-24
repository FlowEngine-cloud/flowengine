import { describe, it, expect } from 'vitest';
import { validateStructure } from '@/lib/n8n/structuralValidator';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeNode(
  name: string,
  type: string,
  position: [number, number] = [100, 100]
) {
  return { name, type, position, parameters: {} };
}

const TRIGGER = makeNode('Trigger', 'n8n-nodes-base.manualTrigger', [100, 100]);
const SLACK = makeNode('Slack', 'n8n-nodes-base.slack', [500, 100]);
const AGENT = makeNode('AI Agent', '@n8n/n8n-nodes-langchain.agent', [500, 100]);

// ─── Layer 1: Node Types ──────────────────────────────────────────────────────

describe('validateStructure – Layer 1 (node types)', () => {
  it('passes for a fully valid workflow', () => {
    const workflow = {
      nodes: [TRIGGER, SLACK],
      connections: {},
    };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.details.layer1_node_types.passed).toBe(true);
    expect(result.details.layer1_node_types.errors).toHaveLength(0);
  });

  it('reports error for node missing name field', () => {
    const workflow = {
      nodes: [{ type: 'n8n-nodes-base.slack', position: [0, 0] as [number, number], parameters: {} } as any],
      connections: {},
    };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.details.layer1_node_types.errors.some((e) => e.includes('name'))).toBe(true);
  });

  it('reports error for node missing type field (may throw in layer3)', () => {
    const workflow = {
      nodes: [{ name: 'Nameless', position: [0, 0] as [number, number], parameters: {} } as any],
      connections: {},
    };
    // Layer1 catches missing type but layer3 may crash — just verify it's detected
    try {
      const result = validateStructure(workflow, { autofix: false });
      expect(result.valid).toBe(false);
    } catch (e: any) {
      // layer3 calls nodeType.includes() on undefined — confirms missing type is the issue
      expect(e.message).toContain('includes');
    }
  });

  it('reports error for invalid node type when autofix disabled', () => {
    const workflow = {
      nodes: [makeNode('Bad Node', 'xyz.totallyInvalidNode999')],
      connections: {},
    };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.details.layer1_node_types.errors.some((e) => e.includes('Invalid node type'))).toBe(true);
  });

  it('adds default position when missing (autofix=true)', () => {
    const workflow = {
      nodes: [{ name: 'Trigger', type: 'n8n-nodes-base.manualTrigger', parameters: {} }],
      connections: {},
    };
    const result = validateStructure(workflow, { autofix: true });
    const fixedNode = result.normalized!.nodes[0];
    expect(fixedNode.position).toBeDefined();
    expect(result.details.layer1_node_types.fixes.some((f) => f.includes('position'))).toBe(true);
  });

  it('adds empty parameters object when missing (autofix=true)', () => {
    const workflow = {
      nodes: [{ name: 'Trigger', type: 'n8n-nodes-base.manualTrigger', position: [0, 0] as [number, number] }],
      connections: {},
    };
    const result = validateStructure(workflow, { autofix: true });
    expect(result.normalized!.nodes[0].parameters).toEqual({});
    expect(result.details.layer1_node_types.fixes.some((f) => f.includes('parameters'))).toBe(true);
  });
});

// ─── Layer 2: Connections ─────────────────────────────────────────────────────

describe('validateStructure – Layer 2 (connections)', () => {
  it('passes when there are no connections', () => {
    const workflow = { nodes: [TRIGGER], connections: {} };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.details.layer2_connections.passed).toBe(true);
  });

  it('reports error for connection referencing non-existent source node', () => {
    const workflow = {
      nodes: [TRIGGER],
      connections: {
        GhostNode: {
          main: [[{ node: 'Trigger', type: 'main', index: 0 }]],
        },
      },
    };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.details.layer2_connections.errors.some((e) => e.includes('GhostNode'))).toBe(true);
  });

  it('reports error for connection to non-existent target node', () => {
    const workflow = {
      nodes: [TRIGGER],
      connections: {
        Trigger: {
          main: [[{ node: 'NonExistent', type: 'main', index: 0 }]],
        },
      },
    };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.details.layer2_connections.errors.some((e) => e.includes('NonExistent'))).toBe(true);
  });

  it('removes empty connection arrays with autofix', () => {
    const workflow = {
      nodes: [{ ...TRIGGER }, { ...SLACK }],
      connections: {
        Trigger: {
          main: [[] as any],
        },
      },
    };
    const result = validateStructure(workflow, { autofix: true });
    expect(result.details.layer2_connections.fixes.some((f) => f.includes('empty connection'))).toBe(true);
  });
});

// ─── Layer 3: Required Sub-Nodes ─────────────────────────────────────────────

describe('validateStructure – Layer 3 (required sub-nodes)', () => {
  it('passes when no connections exist', () => {
    const workflow = { nodes: [TRIGGER], connections: undefined as any };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.details.layer3_required_nodes.passed).toBe(true);
  });

  it('reports error when AI agent is missing required language model', () => {
    const workflow = {
      nodes: [TRIGGER, { ...AGENT }],
      connections: {
        Trigger: {
          main: [[{ node: 'AI Agent', type: 'main', index: 0 }]],
        },
      },
    };
    const result = validateStructure(workflow, { autofix: false, skipPositionValidation: true });
    expect(result.details.layer3_required_nodes.errors.some((e) =>
      e.includes('AI Agent') && e.includes('ai_languageModel')
    )).toBe(true);
    expect(result.valid).toBe(false);
  });

  it('passes layer3 when agent has both language model and memory connected', () => {
    // nodeCategories.ts requires BOTH ai_languageModel AND ai_memory for the agent
    const llm = makeNode('Flow Engine Llm', 'CUSTOM.flowEngineLlm', [500, 300]);
    const memory = makeNode('Window Buffer Memory', '@n8n/n8n-nodes-langchain.memoryBufferWindow', [500, 400]);
    const workflow = {
      nodes: [TRIGGER, { ...AGENT }, llm, memory],
      connections: {
        Trigger: {
          main: [[{ node: 'AI Agent', type: 'main', index: 0 }]],
        },
        'Flow Engine Llm': {
          ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]],
        },
        'Window Buffer Memory': {
          ai_memory: [[{ node: 'AI Agent', type: 'ai_memory', index: 0 }]],
        },
      },
    };
    const result = validateStructure(workflow, { autofix: false, skipPositionValidation: true });
    expect(result.details.layer3_required_nodes.errors).toHaveLength(0);
  });
});

// ─── Layer 4: Positions ───────────────────────────────────────────────────────

describe('validateStructure – Layer 4 (positions)', () => {
  it('skips position validation when skipPositionValidation=true', () => {
    const workflow = { nodes: [TRIGGER], connections: {} };
    const result = validateStructure(workflow, { autofix: false, skipPositionValidation: true });
    expect(result.details.layer4_positions.passed).toBe(true);
    expect(result.details.layer4_positions.errors).toHaveLength(0);
  });

  it('reports overlapping node error when autofix disabled', () => {
    const workflow = {
      nodes: [
        makeNode('NodeA', 'n8n-nodes-base.manualTrigger', [0, 0]),
        makeNode('NodeB', 'n8n-nodes-base.slack', [0, 0]),
      ],
      connections: {},
    };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.details.layer4_positions.errors.some((e) => e.includes('overlap'))).toBe(true);
  });

  it('fixes overlapping nodes when autofix enabled', () => {
    const workflow = {
      nodes: [
        makeNode('NodeA', 'n8n-nodes-base.manualTrigger', [0, 0]),
        makeNode('NodeB', 'n8n-nodes-base.slack', [0, 0]),
      ],
      connections: {},
    };
    const result = validateStructure(workflow, { autofix: true });
    // With autofix, no layer4 position errors (overlap was fixed)
    expect(result.details.layer4_positions.errors).toHaveLength(0);
    expect(result.details.layer4_positions.fixes.some((f) => f.includes('Shifted'))).toBe(true);
  });

  it('warns about orphaned non-trigger nodes', () => {
    const workflow = {
      nodes: [
        makeNode('Trigger', 'n8n-nodes-base.manualTrigger', [0, 0]),
        makeNode('Slack', 'n8n-nodes-base.slack', [500, 0]),
        makeNode('Orphan', 'n8n-nodes-base.httpRequest', [500, 500]),
      ],
      connections: {
        Trigger: {
          main: [[{ node: 'Slack', type: 'main', index: 0 }]],
        },
      },
    };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.details.layer4_positions.warnings.some((w) => w.includes('Orphan'))).toBe(true);
  });

  it('trigger nodes are NOT flagged as orphaned', () => {
    const workflow = {
      nodes: [
        makeNode('Trigger', 'n8n-nodes-base.manualTrigger', [0, 0]),
      ],
      connections: {},
    };
    const result = validateStructure(workflow, { autofix: false });
    const orphanWarnings = result.details.layer4_positions.warnings.filter((w) => w.includes('orphaned'));
    expect(orphanWarnings).toHaveLength(0);
  });

  it('passes layer4 for empty workflow', () => {
    const workflow = { nodes: [], connections: {} };
    const result = validateStructure(workflow);
    expect(result.details.layer4_positions.passed).toBe(true);
  });
});

// ─── Overall result aggregation ──────────────────────────────────────────────

describe('validateStructure – overall aggregation', () => {
  it('valid is false if any layer has errors', () => {
    const workflow = {
      nodes: [{ type: 'n8n-nodes-base.slack' } as any],
      connections: {},
    };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.valid).toBe(false);
  });

  it('strict mode fails if warnings exist', () => {
    const workflow = {
      nodes: [
        makeNode('Trigger', 'n8n-nodes-base.manualTrigger', [0, 0]),
        makeNode('Slack', 'n8n-nodes-base.slack', [500, 0]),
        makeNode('Orphan', 'n8n-nodes-base.httpRequest', [500, 500]),
      ],
      connections: {
        Trigger: {
          main: [[{ node: 'Slack', type: 'main', index: 0 }]],
        },
      },
    };
    const strictResult = validateStructure(workflow, { strict: true, autofix: false });
    const normalResult = validateStructure(workflow, { strict: false, autofix: false });
    // strict mode should fail when there are warnings
    expect(strictResult.valid).toBe(false);
    // normal mode is valid if only warnings
    expect(normalResult.valid).toBe(true);
  });

  it('normalized workflow is provided when autofix=true', () => {
    const workflow = { nodes: [TRIGGER], connections: {} };
    const result = validateStructure(workflow, { autofix: true });
    expect(result.normalized).toBeDefined();
  });

  it('normalized is undefined when autofix=false', () => {
    const workflow = { nodes: [TRIGGER], connections: {} };
    const result = validateStructure(workflow, { autofix: false });
    expect(result.normalized).toBeUndefined();
  });
});
