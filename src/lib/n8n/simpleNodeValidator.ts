/**
 * SIMPLE NODE VALIDATOR
 *
 * Uses REAL node list extracted from n8n-nodes-base package
 * Total: 434 real nodes validated against actual n8n installation
 */

import * as fs from 'fs';
import * as path from 'path';
import { suggestNodeType } from './nodeRegistry';

export interface SimpleValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fixes: string[];
  normalized?: any;
}

// Load REAL nodes from extracted list
const REAL_NODES_PATH = path.join(__dirname, 'real_n8n_nodes.txt');
const REAL_NODES = new Set(
  fs.readFileSync(REAL_NODES_PATH, 'utf-8')
    .split('\n')
    .filter(line => line.trim())
);

/**
 * SIMPLE validation: Check if nodes exist in REAL n8n installation
 */
export function validateNodes(workflow: any, autofix: boolean = true): SimpleValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: string[] = [];

  // Clone workflow if autofix
  const workingWorkflow = autofix ? JSON.parse(JSON.stringify(workflow)) : workflow;

  // Validate each node
  for (const node of workingWorkflow.nodes) {
    const nodeType = node.type;
    const nodeName = node.name || 'unnamed';

    // Check if node exists in REAL n8n installation
    if (!REAL_NODES.has(nodeType)) {
      // Node is INVALID - try to fix it

      if (autofix) {
        // Try to find similar registered node
        const suggestion = suggestNodeType(nodeName + ' ' + nodeType);

        if (suggestion && REAL_NODES.has(suggestion)) {
          // Found a valid similar node
          node.type = suggestion;
          fixes.push(`🔄 Converted "${nodeName}": ${nodeType} → ${suggestion}`);
        } else {
          // No valid suggestion - convert to httpRequest
          const oldType = nodeType;
          node.type = 'n8n-nodes-base.httpRequest';

          // Add retry parameters
          if (!node.parameters) node.parameters = {};
          node.parameters.options = {
            ...node.parameters.options,
            retry: {
              retryOnFail: true,
              maxTries: 3,
              waitBetweenTries: 5000
            }
          };

          fixes.push(
            `🔄 Converted invalid node "${nodeName}" (${oldType}) → httpRequest with retry. ` +
            `Configure API endpoint in n8n.`
          );
        }
      } else {
        // No autofix - just report error
        errors.push(`❌ Invalid node type: "${nodeType}" in node "${nodeName}" does not exist in n8n`);
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    fixes,
    normalized: autofix ? workingWorkflow : undefined
  };
}
