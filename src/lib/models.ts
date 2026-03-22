/**
 * Model configuration constants for planner/executor split
 *
 * Planner Model: Used for quick intent analysis, non-workflow responses, and routing decisions
 * Executor Model: Used for actual content generation and workflow execution
 */

// Model type definitions for strict typing
export interface ModelConfig {
  readonly id: string;
  readonly name: string;
  readonly provider: 'anthropic' | 'openai' | 'other';
  readonly contextWindow: number;
  readonly isDefault?: boolean;
}

export interface PlannerExecutorConfig {
  readonly plannerModel: string;
  readonly defaultExecutorModel: string;
  readonly boostExecutorModel: string;
}

// Planner model - optimized for quick responses and intent detection
// Configurable via environment variable for different deployments
export const PLANNER_MODEL: string =
  process.env.NEXT_PUBLIC_PLANNER_MODEL || 'claude-haiku-4-5';

// Default executor model - optimized for complex reasoning and workflow generation
// Configurable via environment variable for different deployments
export const DEFAULT_EXECUTOR_MODEL: string =
  process.env.NEXT_PUBLIC_DEFAULT_EXECUTOR_MODEL || 'claude-sonnet-4-6';

// Boost executor model - premium model for enhanced performance
// Configurable via environment variable for different deployments
export const BOOST_EXECUTOR_MODEL: string =
  process.env.NEXT_PUBLIC_BOOST_EXECUTOR_MODEL || 'claude-opus-4-6';

// Model configuration object for strict typing
export const MODEL_CONFIG: PlannerExecutorConfig = {
  plannerModel: PLANNER_MODEL,
  defaultExecutorModel: DEFAULT_EXECUTOR_MODEL,
  boostExecutorModel: BOOST_EXECUTOR_MODEL,
} as const;

// Available models with metadata (for reference)
// IMPORTANT: Only include allowed models (Haiku for planning, Sonnet 3.5 for regular, Sonnet 4.5 for boost)
export const AVAILABLE_MODELS: readonly ModelConfig[] = [
  {
    id: 'claude-sonnet-4-6',
    name: 'Claude Sonnet 4.6',
    provider: 'anthropic',
    contextWindow: 200000,
    isDefault: true,
  },
  {
    id: 'claude-opus-4-6',
    name: 'Claude Opus 4.6',
    provider: 'anthropic',
    contextWindow: 200000,
  },
  {
    id: 'claude-haiku-4-5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    contextWindow: 200000,
  },
] as const;

/**
 * Get model configuration by ID
 * @param modelId - The model ID to look up
 * @returns Model configuration or undefined if not found
 */
export function getModelConfig(modelId: string): ModelConfig | undefined {
  return AVAILABLE_MODELS.find(model => model.id === modelId);
}

/**
 * Check if a model ID is valid
 * @param modelId - The model ID to validate
 * @returns True if the model is available, false otherwise
 */
export function isValidModel(modelId: string): boolean {
  return AVAILABLE_MODELS.some(model => model.id === modelId);
}

/**
 * Get the planner model configuration
 * @returns The configured planner model ID
 */
export function getPlannerModel(): string {
  return PLANNER_MODEL;
}

/**
 * Get the default executor model configuration
 * @returns The default executor model ID
 */
export function getDefaultExecutorModel(): string {
  return DEFAULT_EXECUTOR_MODEL;
}

/**
 * Get the boost executor model configuration
 * @returns The boost executor model ID
 */
export function getBoostExecutorModel(): string {
  return BOOST_EXECUTOR_MODEL;
}
