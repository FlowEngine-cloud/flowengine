# N8N Workflow Validator Guide

## ✅ Use This: localValidator.ts

**Always use `localValidator.ts` for workflow validation.**

```typescript
import { validateWithN8n } from '@/lib/n8n/localValidator';

// Validate workflow with autofix
const result = await validateWithN8n(workflowJson, { autofix: true });

if (result.valid) {
  console.log('✅ Valid workflow');
  if (result.normalized) {
    // Use the auto-fixed workflow
    useWorkflow(result.normalized);
  }
} else {
  console.error('❌ Invalid workflow:', result.errors);
}
```

### Why localValidator?

✅ **Comprehensive validation**: Uses full n8n node registry from `nodeRegistry.ts`
✅ **Better error messages**: Provides specific suggestions for invalid nodes
✅ **Smart autofix**: Automatically fixes common issues:
- Missing workflow name → adds "My Workflow"
- Missing connections object → adds empty connections
- Invalid node types → suggests closest real node
- Generic node names → generates descriptive names
- Missing required fields → adds defaults

✅ **Proper structure checks**: Validates complete workflow structure including:
- All required node properties (id, name, type, position, parameters)
- Connection integrity and references
- Workflow metadata (name, connections, settings)

## 🗑️ Removed Validators

The following validators have been removed from the codebase:

- **`lightValidator.ts`** - Deprecated (limited node registry, replaced by localValidator)
- **`workflowValidator.ts`** - Unused (over-engineered for current use case)

### Migration:

```typescript
// ❌ OLD (deprecated):
import { validateWorkflowLight } from '@/lib/n8n/lightValidator';
const result = validateWorkflowLight(workflow, true);

// ✅ NEW (correct):
import { validateWithN8n } from '@/lib/n8n/localValidator';
const result = await validateWithN8n(workflow, { autofix: true });
```

## Validation Result Interface

```typescript
interface ValidationResult {
  valid: boolean;           // Is the workflow valid?
  isValid: boolean;         // Alias for valid
  errors: string[];         // List of validation errors
  warnings: string[];       // List of warnings (non-critical)
  fixes?: string[];         // List of fixes applied (if autofix enabled)
  autofixed?: boolean;      // Were fixes applied?
  normalized?: any;         // Auto-fixed workflow (if autofix enabled)
  normalizedIncluded?: boolean; // Is normalized workflow included?
}
```

## Best Practices

### 1. Always Use Autofix

```typescript
// ✅ Enable autofix for better UX
const result = await validateWithN8n(workflow, { autofix: true });

if (result.normalized) {
  // Use the fixed workflow
  workflow = result.normalized;
}
```

### 2. Check Both valid and normalized

```typescript
const result = await validateWithN8n(workflow, { autofix: true });

if (result.valid) {
  // Use normalized version if available (contains fixes)
  const finalWorkflow = result.normalized || workflow;
  onWorkflowUpdate(finalWorkflow);
}
```

### 3. Log Validation Details

```typescript
console.log('[VALIDATION]', {
  valid: result.valid,
  autofixed: result.autofixed,
  errorCount: result.errors.length,
  warningCount: result.warnings.length,
  fixes: result.fixes
});
```

## Common Validation Errors and Fixes

| Error | Autofix |
|-------|---------|
| Missing workflow name | Adds "My Workflow" |
| Missing connections object | Adds empty `{}` |
| Invalid node type | Suggests closest real node from registry |
| Generic node name (Node1, node2) | Generates descriptive name from type |
| Missing node ID | Generates unique ID |
| Missing node position | Calculates layout position |
| Missing parameters | Adds empty `{}` |
| Invalid typeVersion | Sets to `1` |

## Examples

### Basic Validation

```typescript
import { validateWithN8n } from '@/lib/n8n/localValidator';

const workflow = {
  nodes: [
    {
      type: 'n8n-nodes-base.manualTrigger',
      name: 'Manual Trigger',
      // ... other properties
    }
  ],
  connections: {}
};

const result = await validateWithN8n(workflow, { autofix: true });

if (!result.valid) {
  console.error('Validation errors:', result.errors);
}
```

### Validation in Router (API)

```typescript
import { validateWithN8n } from '@/lib/n8n/localValidator';
import { WorkflowProcessor } from '@/lib/workflowProcessor';

// Extract workflow from response
const workflowDetection = WorkflowProcessor.extractWorkflowJSON(content);

if (workflowDetection.hasWorkflow && workflowDetection.workflowJSON) {
  // Validate with autofix
  const validationResult = await validateWithN8n(
    workflowDetection.workflowJSON,
    { autofix: true }
  );

  // Use normalized workflow if fixes were applied
  if (validationResult.normalized) {
    workflowDetection.workflowJSON = validationResult.normalized;
  }

  console.log('[VALIDATION]', {
    valid: validationResult.valid,
    autofixed: validationResult.autofixed,
    errors: validationResult.errors.length,
    warnings: validationResult.warnings.length
  });
}
```

## Node Registry

The validator uses the comprehensive node registry from `nodeRegistry.ts` which includes:

- **Base Nodes**: 18 core n8n nodes (triggers, HTTP, code, set, merge, etc.)
- **AI Nodes**: 11 LangChain AI nodes (agents, chains, tools)
- **Service Nodes**: 40+ integration nodes (Gmail, Slack, Notion, etc.)

Total: **68+ validated node types**

See [nodeRegistry.ts](./nodeRegistry.ts) for the complete list.

## Files

- ✅ **`localValidator.ts`** - Use this for all validation
- ✅ **`nodeRegistry.ts`** - Comprehensive node type registry
- ✅ **`nodeCategories.generated.ts`** - SINGLE SOURCE OF TRUTH for all valid node types
- ❌ **`lightValidator.ts`** - DEPRECATED, do not use
- ❌ **`nodeTypes.generated.ts`** - DELETED, use nodeCategories.generated.ts instead

## Questions?

If you encounter validation issues:

1. Check the validation result's `errors` array for specific problems
2. Enable autofix to automatically fix common issues
3. Verify node types exist in `nodeRegistry.ts`
4. Check console logs for detailed validation output
