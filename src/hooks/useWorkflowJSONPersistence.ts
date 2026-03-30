/**
 * Hook to ensure workflow JSON is always available and persisted
 */

import { useEffect, useRef } from 'react';
import { WorkflowJSONRecognizer } from '@/lib/workflowJSONRecognizer';
import type { WorkflowDetectionResult } from '@/lib/workflowProcessor';

interface JSONPersistenceOptions {
  conversationId: string;
  onJSONFound?: (json: string) => void;
  onWorkflowUpdate?: (workflowData: WorkflowDetectionResult) => void;
}

export function useWorkflowJSONPersistence(
  workflowData: WorkflowDetectionResult | null,
  options: JSONPersistenceOptions
) {
  const lastJSONRef = useRef<string>('');
  const { conversationId, onJSONFound, onWorkflowUpdate } = options;

  useEffect(() => {
    // Skip if no workflow data
    if (!workflowData) {
      // Try to restore from localStorage
      const stored = localStorage.getItem(`workflow_json_${conversationId}`);
      if (stored && stored !== lastJSONRef.current) {
        console.log('🔄 Restoring JSON from localStorage');
        lastJSONRef.current = stored;
        onJSONFound?.(stored);

        // Try to create workflow data from stored JSON
        try {
          const parsed = JSON.parse(stored);
          const restoredWorkflowData: WorkflowDetectionResult = {
            hasWorkflow: WorkflowJSONRecognizer.isCompleteWorkflow(parsed),
            isPartial: false,
            workflowJSON: parsed,
            workflow: parsed,
            partialJson: stored,
            cleanContent: 'Restored workflow',
          };
          onWorkflowUpdate?.(restoredWorkflowData);
        } catch (error) {
          console.error('Error restoring workflow from localStorage:', error);
        }
      }
      return;
    }

    // Use JSON recognizer to extract the best available JSON
    const recognition = WorkflowJSONRecognizer.recognizeJSON(workflowData);

    if (recognition.hasJSON && recognition.jsonContent) {
      // Check if this is new JSON content
      if (recognition.jsonContent !== lastJSONRef.current) {
        console.log('💾 Persisting new JSON content to localStorage');

        // Store in localStorage for persistence
        localStorage.setItem(`workflow_json_${conversationId}`, recognition.jsonContent);

        // Update ref
        lastJSONRef.current = recognition.jsonContent;

        // Notify callback
        onJSONFound?.(recognition.jsonContent);

        // If workflowData is missing partialJson, enhance it
        if (!workflowData.partialJson) {
          const enhancedData: WorkflowDetectionResult = {
            ...workflowData,
            partialJson: recognition.jsonContent,
          };
          onWorkflowUpdate?.(enhancedData);
        }
      }
    }
  }, [workflowData, conversationId, onJSONFound, onWorkflowUpdate]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Optional: Clear stored JSON on unmount if needed
      // localStorage.removeItem(`workflow_json_${conversationId}`);
    };
  }, [conversationId]);

  return {
    hasPersistedJSON: !!lastJSONRef.current,
    persistedJSON: lastJSONRef.current,
  };
}
