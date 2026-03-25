import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}

// Cache settings for 60 seconds to avoid hitting DB on every API request
let cachedSettings: Record<string, any> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60_000; // 1 minute

export interface PortalSettings {
  // n8n
  n8n_base_url: string | null;
  n8n_api_key: string | null;
  n8n_webhook_url: string | null;
  // AI Provider (any OpenAI-compatible API, e.g. OpenRouter)
  ai_base_url: string | null;
  ai_api_key: string | null;
  // n8n SMTP
  n8n_smtp_host: string | null;
  n8n_smtp_port: number;
  n8n_smtp_user: string | null;
  n8n_smtp_pass: string | null;
  n8n_smtp_sender: string | null;
  n8n_smtp_ssl: boolean;
  // n8n Docker
  n8n_docker_image: string;
  n8n_runners_enabled: boolean;
  n8n_runner_image: string | null;
  // FlowEngine API
  flowengine_api_key: string | null;
  flowengine_api_url: string | null;
  // General
  admin_email: string | null;
}

// Mapping from DB column name to env var fallback
const ENV_FALLBACKS: Record<string, string> = {
  n8n_base_url: 'N8N_BASE_URL',
  n8n_api_key: 'N8N_API_KEY',
  n8n_webhook_url: 'N8N_WEBHOOK_URL',
  ai_base_url: 'AI_BASE_URL',
  ai_api_key: 'AI_API_KEY',
  n8n_smtp_host: 'N8N_SMTP_HOST',
  n8n_smtp_port: 'N8N_SMTP_PORT',
  n8n_smtp_user: 'N8N_SMTP_USER',
  n8n_smtp_pass: 'N8N_SMTP_PASS',
  n8n_smtp_sender: 'N8N_SMTP_SENDER',
  n8n_smtp_ssl: 'N8N_SMTP_SSL',
  n8n_docker_image: 'N8N_DOCKER_IMAGE',
  n8n_runners_enabled: 'N8N_RUNNERS_ENABLED',
  n8n_runner_image: 'N8N_RUNNER_IMAGE',
  flowengine_api_key: 'FLOWENGINE_API_KEY',
  flowengine_api_url: 'FLOWENGINE_API_URL',
  admin_email: 'ADMIN_EMAIL',
};

/**
 * Fetches portal settings from the database, with env var fallback.
 * Results are cached for 60 seconds.
 */
export async function getPortalSettings(): Promise<PortalSettings> {
  const now = Date.now();
  if (cachedSettings && now - cacheTimestamp < CACHE_TTL) {
    return cachedSettings as PortalSettings;
  }

  try {
    const { data } = await getSupabaseAdmin()
      .from('portal_settings')
      .select('*')
      .limit(1)
      .single();

    const settings: Record<string, any> = {};

    for (const [key, envVar] of Object.entries(ENV_FALLBACKS)) {
      // DB value takes precedence over env var
      const dbValue = data?.[key];
      const envValue = process.env[envVar];
      settings[key] = dbValue ?? envValue ?? null;
    }

    // Apply defaults for non-nullable fields
    settings.n8n_smtp_port = settings.n8n_smtp_port ?? 587;
    settings.n8n_smtp_ssl = settings.n8n_smtp_ssl ?? false;
    settings.n8n_docker_image = settings.n8n_docker_image ?? 'n8nio/n8n:latest';
    settings.n8n_runners_enabled = settings.n8n_runners_enabled ?? false;

    cachedSettings = settings;
    cacheTimestamp = now;

    return settings as PortalSettings;
  } catch (error) {
    console.error('[portalSettings] Failed to load from DB, using env fallback:', error);

    // Full env fallback
    const settings: Record<string, any> = {};
    for (const [key, envVar] of Object.entries(ENV_FALLBACKS)) {
      settings[key] = process.env[envVar] ?? null;
    }
    settings.n8n_smtp_port = parseInt(process.env.N8N_SMTP_PORT || '587', 10);
    settings.n8n_smtp_ssl = process.env.N8N_SMTP_SSL === 'true';
    settings.n8n_docker_image = process.env.N8N_DOCKER_IMAGE || 'n8nio/n8n:latest';
    settings.n8n_runners_enabled = process.env.N8N_RUNNERS_ENABLED === 'true';

    return settings as PortalSettings;
  }
}

/**
 * Get a single portal setting by key.
 */
export async function getPortalSetting<K extends keyof PortalSettings>(key: K): Promise<PortalSettings[K]> {
  const settings = await getPortalSettings();
  return settings[key];
}

/**
 * Invalidate the settings cache (call after updating settings).
 */
export function invalidateSettingsCache() {
  cachedSettings = null;
  cacheTimestamp = 0;
}
