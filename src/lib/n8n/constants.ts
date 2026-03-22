// N8N Docker image with FlowEngine node pre-installed
export const N8N_DOCKER_IMAGE = process.env.N8N_DOCKER_IMAGE || 'ami3466/n8n-flowengine:latest';

// N8N Task Runner image - version should match n8n version for compatibility
// See: https://docs.n8n.io/hosting/configuration/task-runners/
export const N8N_RUNNER_IMAGE = process.env.N8N_RUNNER_IMAGE || 'n8nio/runners:latest';

// Control whether n8n has N8N_RUNNERS_ENABLED=true in its environment (default: true)
// Set to 'false' to disable runner support in n8n
export const N8N_RUNNERS_ENABLED = process.env.N8N_RUNNERS_ENABLED !== 'false';

// Control whether to include the n8n-runner container in docker-compose (default: true)
// Set to 'false' to exclude the runner container entirely and save resources
export const N8N_INCLUDE_RUNNER_CONTAINER = process.env.N8N_INCLUDE_RUNNER_CONTAINER !== 'false';
