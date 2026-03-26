import { describe, it, expect } from 'vitest';
import { WorkflowProcessor } from '@/lib/workflowProcessor';

// ─── ensureAIAgentStructure ───────────────────────────────────────────────────

describe('WorkflowProcessor.ensureAIAgentStructure', () => {
  it('returns the workflow unchanged (stub implementation)', () => {
    const workflow = { nodes: [{ id: 'n1', type: 'n8n-nodes-base.slack' }], connections: {} };
    expect(WorkflowProcessor.ensureAIAgentStructure(workflow)).toBe(workflow);
  });

  it('returns null unchanged', () => {
    expect(WorkflowProcessor.ensureAIAgentStructure(null)).toBeNull();
  });

  it('returns undefined unchanged', () => {
    expect(WorkflowProcessor.ensureAIAgentStructure(undefined)).toBeUndefined();
  });

  it('returns a string unchanged', () => {
    expect(WorkflowProcessor.ensureAIAgentStructure('test')).toBe('test');
  });
});

// ─── detectWorkflow ───────────────────────────────────────────────────────────

describe('WorkflowProcessor.detectWorkflow', () => {
  it('returns hasWorkflow: false for any string (stub)', () => {
    const result = WorkflowProcessor.detectWorkflow('hello world');
    expect(result.hasWorkflow).toBe(false);
  });

  it('returns isPartial: false', () => {
    expect(WorkflowProcessor.detectWorkflow('some content').isPartial).toBe(false);
  });

  it('returns cleanContent equal to the input string', () => {
    const content = 'some content here';
    expect(WorkflowProcessor.detectWorkflow(content).cleanContent).toBe(content);
  });

  it('returns cleanContent as empty string for empty input', () => {
    const result = WorkflowProcessor.detectWorkflow('');
    expect(result.cleanContent).toBe('');
    expect(result.hasWorkflow).toBe(false);
  });

  it('does not throw for workflow-like JSON content', () => {
    const content = JSON.stringify({ nodes: [], connections: {} });
    expect(() => WorkflowProcessor.detectWorkflow(content)).not.toThrow();
  });
});
