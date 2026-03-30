/**
 * Shared Docker Compose generator for n8n instances.
 * Used by both provision-instance and server migration.
 */

import { N8N_DOCKER_IMAGE, N8N_RUNNER_IMAGE, N8N_RUNNERS_ENABLED, N8N_INCLUDE_RUNNER_CONTAINER } from '@/lib/n8n/constants';
import { getResourceLimits } from '@/lib/n8n/resources';

export function generatePassword(): string {
  // Use only alphanumeric characters to avoid any escaping issues with:
  // - Docker Compose variable interpolation ($)
  // - URL encoding (%, &, etc.)
  // - Shell escaping (!, *, etc.)
  // - PostgreSQL connection strings
  const { randomBytes } = require('crypto');
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = randomBytes(32);
  return Array.from(bytes as Buffer).map((b: number) => chars[b % chars.length]).join('');
}

export function generateDockerCompose(
  userId: string,
  storageLimit: number,
  adminEmail: string,
  postgresUser: string,
  postgresPassword: string,
  postgresDatabase: string,
  aiApiKey: string | null = null,
  serverDomain: string,
  existingSubdomain?: string
): { dockerCompose: string; instanceUrl: string } {
  // Reuse existing subdomain (subscription reactivation) or generate new one
  const fullDomain = existingSubdomain || (() => {
    const randomChars = Math.random().toString(36).substring(2, 8);
    return `${userId.substring(0, 8).toLowerCase()}${randomChars}.${serverDomain}`;
  })();
  const subdomain = fullDomain.split('.')[0];
  const instanceUrl = `https://${fullDomain}`;

  // Generate secure token for task runner authentication (only if runner container included)
  const runnerAuthToken = N8N_INCLUDE_RUNNER_CONTAINER ? generatePassword() : '';

  // Get resource limits based on tier
  const limits = getResourceLimits(storageLimit);

  // SECURITY FEATURES:
  // - CPU/Memory limits prevent resource exhaustion (bad neighbor problem)
  // - Traefik rate limiting prevents request flooding (30 req/s average, 60 burst)
  // - Memory reservations ensure minimum resources are available
  const dockerCompose = `services:
  postgresql:
    image: 'postgres:16'
    environment:
      POSTGRES_USER: '${postgresUser}'
      POSTGRES_PASSWORD: '${postgresPassword}'
      POSTGRES_DB: '${postgresDatabase}'
    volumes:
      - 'postgres-data:/var/lib/postgresql/data'
    deploy:
      resources:
        limits:
          cpus: '${limits.postgres.cpus}'
          memory: ${limits.postgres.memory}
        reservations:
          cpus: '0.25'
          memory: 256M
    healthcheck:
      test:
        - CMD-SHELL
        - 'pg_isready -U ${postgresUser} -d ${postgresDatabase}'
      interval: 5s
      timeout: 5s
      retries: 10
  n8n:
    image: ${N8N_DOCKER_IMAGE}
    pull_policy: always
    environment:
      - 'N8N_EDITOR_BASE_URL=https://${fullDomain}'
      - 'WEBHOOK_URL=https://${fullDomain}'
      - 'N8N_HOST=https://${fullDomain}'
      - 'GENERIC_TIMEZONE=\${GENERIC_TIMEZONE:-America/New_York}'
      - 'TZ=\${TZ:-America/New_York}'
      - DB_TYPE=postgresdb
      - 'DB_POSTGRESDB_DATABASE=${postgresDatabase}'
      - DB_POSTGRESDB_HOST=postgresql
      - DB_POSTGRESDB_PORT=5432
      - 'DB_POSTGRESDB_USER=${postgresUser}'
      - DB_POSTGRESDB_SCHEMA=public
      - 'DB_POSTGRESDB_PASSWORD=${postgresPassword}'
      - N8N_RUNNERS_ENABLED=${N8N_RUNNERS_ENABLED ? 'true' : 'false'}${N8N_RUNNERS_ENABLED && N8N_INCLUDE_RUNNER_CONTAINER ? `
      - N8N_RUNNERS_MODE=external
      - N8N_RUNNERS_BROKER_LISTEN_ADDRESS=0.0.0.0
      - N8N_RUNNERS_AUTH_TOKEN=${runnerAuthToken}` : ''}
      - 'N8N_BLOCK_ENV_ACCESS_IN_NODE=\${N8N_BLOCK_ENV_ACCESS_IN_NODE:-true}'
      - 'N8N_GIT_NODE_DISABLE_BARE_REPOS=\${N8N_GIT_NODE_DISABLE_BARE_REPOS:-true}'
      - 'N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=\${N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS:-true}'
      - 'N8N_PROXY_HOPS=\${N8N_PROXY_HOPS:-1}'
      - N8N_EMAIL_MODE=smtp
      - N8N_SMTP_HOST=${process.env.N8N_SMTP_HOST || 'smtp.gmail.com'}
      - N8N_SMTP_PORT=${process.env.N8N_SMTP_PORT || '587'}
      - N8N_SMTP_USER=${process.env.N8N_SMTP_USER || ''}
      - N8N_SMTP_PASS=${process.env.N8N_SMTP_PASS || ''}
      - N8N_SMTP_SENDER=${process.env.N8N_SMTP_SENDER || ''}
      - N8N_SMTP_SSL=${process.env.N8N_SMTP_SSL || 'false'}${aiApiKey ? `
      - FLOWENGINE_LLM_API_KEY=${aiApiKey}` : ''}
    volumes:
      - 'n8n-data:/home/node/.n8n'
    networks:
      - coolify
    deploy:
      resources:
        limits:
          cpus: '${limits.n8n.cpus}'
          memory: ${limits.n8n.memory}
        reservations:
          cpus: '0.5'
          memory: 512M
    depends_on:
      postgresql:
        condition: service_healthy
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.n8n-${subdomain}.rule=Host(\`${fullDomain}\`)'
      - 'traefik.http.routers.n8n-${subdomain}.entrypoints=https'
      - 'traefik.http.routers.n8n-${subdomain}.tls=true'
      - 'traefik.http.routers.n8n-${subdomain}.tls.certresolver=letsencrypt'
      - 'traefik.http.services.n8n-${subdomain}.loadbalancer.server.port=5678'
      - 'traefik.docker.network=coolify'
      # Rate limiting middleware - prevents request flooding
      # 30 req/s average with 60 burst protects against abuse while allowing normal usage
      - 'traefik.http.middlewares.ratelimit-${subdomain}.ratelimit.average=30'
      - 'traefik.http.middlewares.ratelimit-${subdomain}.ratelimit.burst=60'
      - 'traefik.http.middlewares.ratelimit-${subdomain}.ratelimit.period=1s'
      - 'traefik.http.routers.n8n-${subdomain}.middlewares=ratelimit-${subdomain}@docker'
    healthcheck:
      test:
        - CMD-SHELL
        - 'wget -qO- http://127.0.0.1:5678/'
      interval: 5s
      timeout: 20s
      retries: 10${N8N_INCLUDE_RUNNER_CONTAINER ? `
  n8n-runner:
    image: ${N8N_RUNNER_IMAGE}
    pull_policy: always
    environment:
      - N8N_RUNNERS_TASK_BROKER_URI=http://n8n:5679
      - N8N_RUNNERS_AUTH_TOKEN=${runnerAuthToken}
      - N8N_RUNNERS_MAX_CONCURRENCY=5
    networks:
      - coolify
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    depends_on:
      n8n:
        condition: service_healthy
    healthcheck:
      test:
        - CMD-SHELL
        - 'wget -qO- http://127.0.0.1:5680/healthz || exit 0'
      interval: 10s
      timeout: 5s
      retries: 5` : ''}
networks:
  coolify:
    external: true
volumes:
  postgres-data: null
  n8n-data: null
`;

  return { dockerCompose, instanceUrl };
}
