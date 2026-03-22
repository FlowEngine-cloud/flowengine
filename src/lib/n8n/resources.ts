/**
 * Shared resource limits configuration for n8n instance tiers.
 * Single source of truth — used by both provision routes and smart deployment balancer.
 */

export interface ResourceLimits {
  n8n: { cpus: string; memory: string };
  postgres: { cpus: string; memory: string };
}

/**
 * Returns Docker resource limits (CPU cores, memory) for n8n + PostgreSQL
 * based on the storage tier.
 */
export function getResourceLimits(storageLimit: number): ResourceLimits {
  if (storageLimit >= 50) {
    return {
      n8n: { cpus: '2.0', memory: '4G' },
      postgres: { cpus: '1.0', memory: '2G' },
    };
  }
  if (storageLimit >= 30) {
    return {
      n8n: { cpus: '1.5', memory: '3G' },
      postgres: { cpus: '0.75', memory: '1.5G' },
    };
  }
  return {
    n8n: { cpus: '1.0', memory: '2G' },
    postgres: { cpus: '0.5', memory: '1G' },
  };
}

/**
 * Returns numeric resource values for capacity tracking (P2 cap allocation).
 * Only n8n caps are tracked at server level — postgres caps stored per-instance for reference.
 */
export function getResourceCaps(storageLimit: number): {
  n8nCpu: number;
  n8nMemoryGb: number;
  pgCpu: number;
  pgMemoryGb: number;
  diskGb: number;
} {
  if (storageLimit >= 50) {
    return { n8nCpu: 2.0, n8nMemoryGb: 4, pgCpu: 1.0, pgMemoryGb: 2, diskGb: 50 };
  }
  if (storageLimit >= 30) {
    return { n8nCpu: 1.5, n8nMemoryGb: 3, pgCpu: 0.75, pgMemoryGb: 1.5, diskGb: 30 };
  }
  return { n8nCpu: 1.0, n8nMemoryGb: 2, pgCpu: 0.5, pgMemoryGb: 1, diskGb: 10 };
}
