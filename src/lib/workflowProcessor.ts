/**
 * WorkflowProcessor stub for the open-source portal.
 *
 * The full implementation lives in the main FlowEngine repo and depends on
 * internal n8n position validators and pattern detectors.
 * This minimal stub satisfies imports that only use ensureAIAgentStructure.
 */

export interface WorkflowDetectionResult {
  hasWorkflow: boolean;
  isPartial: boolean;
  workflowJSON?: any;
  cleanContent: string;
  partialJson?: string;
  validationErrors?: string[];
  validationWarnings?: string[];
  isStreaming?: boolean;
  workflow?: any;
  unvalidated?: boolean;
}

export class WorkflowProcessor {
  /**
   * Ensures the workflow JSON has the expected AI Agent structure.
   * Stub implementation - returns the workflow as-is.
   */
  static ensureAIAgentStructure(workflow: any): any {
    return workflow;
  }

  /**
   * Detects and extracts workflow JSON from content.
   * Stub implementation.
   */
  static detectWorkflow(content: string): WorkflowDetectionResult {
    return {
      hasWorkflow: false,
      isPartial: false,
      cleanContent: content,
    };
  }
}
