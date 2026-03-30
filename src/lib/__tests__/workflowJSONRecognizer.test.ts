import { describe, it, expect } from 'vitest';
import { WorkflowJSONRecognizer } from '@/lib/workflowJSONRecognizer';

describe('WorkflowJSONRecognizer', () => {
  describe('extractWorkflowJSON', () => {
    it('returns null (stub not yet implemented)', () => {
      expect(WorkflowJSONRecognizer.extractWorkflowJSON('some text')).toBeNull();
      expect(WorkflowJSONRecognizer.extractWorkflowJSON('')).toBeNull();
    });
  });

  describe('isValidWorkflowJSON', () => {
    it('returns true for valid JSON object', () => {
      expect(WorkflowJSONRecognizer.isValidWorkflowJSON('{"nodes":[]}')).toBe(true);
    });

    it('returns true for any valid JSON object (not just workflows)', () => {
      expect(WorkflowJSONRecognizer.isValidWorkflowJSON('{"foo":"bar"}')).toBe(true);
    });

    it('returns false for invalid JSON', () => {
      expect(WorkflowJSONRecognizer.isValidWorkflowJSON('not json')).toBe(false);
      expect(WorkflowJSONRecognizer.isValidWorkflowJSON('{bad}')).toBe(false);
    });

    it('returns false for JSON primitives (not objects)', () => {
      expect(WorkflowJSONRecognizer.isValidWorkflowJSON('"string"')).toBe(false);
      expect(WorkflowJSONRecognizer.isValidWorkflowJSON('42')).toBe(false);
      expect(WorkflowJSONRecognizer.isValidWorkflowJSON('null')).toBe(false);
    });
  });

  describe('isCompleteWorkflow', () => {
    it('returns true when workflow has a nodes array', () => {
      expect(WorkflowJSONRecognizer.isCompleteWorkflow({ nodes: [] })).toBe(true);
      expect(WorkflowJSONRecognizer.isCompleteWorkflow({ nodes: [{ type: 'x' }] })).toBe(true);
    });

    it('returns false when nodes is not an array', () => {
      expect(WorkflowJSONRecognizer.isCompleteWorkflow({ nodes: 'not-array' })).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(WorkflowJSONRecognizer.isCompleteWorkflow(null)).toBe(false);
      expect(WorkflowJSONRecognizer.isCompleteWorkflow(undefined)).toBe(false);
    });

    it('returns false when nodes key is missing', () => {
      expect(WorkflowJSONRecognizer.isCompleteWorkflow({})).toBe(false);
    });
  });

  describe('recognizeJSON', () => {
    it('returns hasJSON: true when partialJson is present', () => {
      const result = WorkflowJSONRecognizer.recognizeJSON({ partialJson: '{"nodes":[]}' });
      expect(result.hasJSON).toBe(true);
      expect(result.jsonContent).toBe('{"nodes":[]}');
    });

    it('returns hasJSON: false when partialJson is absent', () => {
      const result = WorkflowJSONRecognizer.recognizeJSON({ someOtherKey: 'x' });
      expect(result.hasJSON).toBe(false);
      expect(result.jsonContent).toBeUndefined();
    });

    it('returns hasJSON: false for null input', () => {
      const result = WorkflowJSONRecognizer.recognizeJSON(null);
      expect(result.hasJSON).toBe(false);
    });
  });

  describe('recognizeWorkflowPattern', () => {
    it('always returns false (stub)', () => {
      expect(WorkflowJSONRecognizer.recognizeWorkflowPattern('any text')).toBe(false);
      expect(WorkflowJSONRecognizer.recognizeWorkflowPattern('')).toBe(false);
    });
  });
});
