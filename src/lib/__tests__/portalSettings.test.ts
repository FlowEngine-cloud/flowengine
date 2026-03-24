import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock Supabase BEFORE importing the module under test ─────────────────────

const mockSingle = vi.fn();
const mockLimit = vi.fn().mockReturnValue({ single: mockSingle });
const mockSelect = vi.fn().mockReturnValue({ limit: mockLimit });
const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ from: mockFrom }),
}));

// Import after mock is in place
import { getPortalSettings, getPortalSetting, invalidateSettingsCache } from '@/lib/portalSettings';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function mockDbRow(row: Record<string, any> | null) {
  mockSingle.mockResolvedValue({ data: row, error: null });
}

function mockDbError() {
  mockSingle.mockResolvedValue({ data: null, error: { message: 'DB error' } });
}

beforeEach(() => {
  invalidateSettingsCache();
  vi.clearAllMocks();
  // Re-wire chain after clearAllMocks
  mockSingle.mockResolvedValue({ data: null, error: null });
  mockLimit.mockReturnValue({ single: mockSingle });
  mockSelect.mockReturnValue({ limit: mockLimit });
  mockFrom.mockReturnValue({ select: mockSelect });
  // Clear any env overrides
  delete process.env.N8N_BASE_URL;
  delete process.env.FLOWENGINE_API_KEY;
  delete process.env.N8N_SMTP_PORT;
});

// ─── getPortalSettings ────────────────────────────────────────────────────────

describe('getPortalSettings', () => {
  it('returns DB values when row exists', async () => {
    mockDbRow({
      n8n_base_url: 'https://n8n.example.com',
      n8n_api_key: 'n8n-secret',
      flowengine_api_key: 'fe-key',
      n8n_smtp_port: 465,
    });
    const settings = await getPortalSettings();
    expect(settings.n8n_base_url).toBe('https://n8n.example.com');
    expect(settings.n8n_api_key).toBe('n8n-secret');
    expect(settings.flowengine_api_key).toBe('fe-key');
    expect(settings.n8n_smtp_port).toBe(465);
  });

  it('applies default values for non-nullable fields when DB row is empty', async () => {
    mockDbRow({});
    const settings = await getPortalSettings();
    expect(settings.n8n_smtp_port).toBe(587);
    expect(settings.n8n_smtp_ssl).toBe(false);
    expect(settings.n8n_docker_image).toBe('n8nio/n8n:latest');
    expect(settings.n8n_runners_enabled).toBe(false);
  });

  it('falls back to env vars when DB has no value for a key', async () => {
    process.env.N8N_BASE_URL = 'http://env-n8n.local';
    mockDbRow({ n8n_base_url: null });
    const settings = await getPortalSettings();
    expect(settings.n8n_base_url).toBe('http://env-n8n.local');
  });

  it('prefers DB value over env var', async () => {
    process.env.N8N_BASE_URL = 'http://env-n8n.local';
    mockDbRow({ n8n_base_url: 'https://db-n8n.example.com' });
    const settings = await getPortalSettings();
    expect(settings.n8n_base_url).toBe('https://db-n8n.example.com');
  });

  it('returns null for keys not set in DB or env', async () => {
    mockDbRow({});
    const settings = await getPortalSettings();
    expect(settings.n8n_base_url).toBeNull();
    expect(settings.ai_api_key).toBeNull();
  });

  it('falls back to env vars when DB throws an error', async () => {
    process.env.N8N_BASE_URL = 'http://fallback-env.local';
    mockDbError();
    const settings = await getPortalSettings();
    expect(settings.n8n_base_url).toBe('http://fallback-env.local');
    // Default values still applied
    expect(settings.n8n_smtp_port).toBe(587);
    expect(settings.n8n_docker_image).toBe('n8nio/n8n:latest');
  });

  it('caches results and does not call DB again within TTL', async () => {
    mockDbRow({ n8n_base_url: 'https://cached.example.com' });
    await getPortalSettings();
    await getPortalSettings();
    await getPortalSettings();
    // DB was only queried once
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

// ─── getPortalSetting ─────────────────────────────────────────────────────────

describe('getPortalSetting', () => {
  it('returns a specific setting by key', async () => {
    mockDbRow({ flowengine_api_key: 'fp_abc123' });
    const key = await getPortalSetting('flowengine_api_key');
    expect(key).toBe('fp_abc123');
  });

  it('returns null for unset keys', async () => {
    mockDbRow({});
    const key = await getPortalSetting('ai_api_key');
    expect(key).toBeNull();
  });

  it('returns the default n8n_smtp_port value', async () => {
    mockDbRow({});
    const port = await getPortalSetting('n8n_smtp_port');
    expect(port).toBe(587);
  });
});

// ─── invalidateSettingsCache ──────────────────────────────────────────────────

describe('invalidateSettingsCache', () => {
  it('forces a fresh DB fetch after invalidation', async () => {
    mockDbRow({ n8n_base_url: 'https://v1.example.com' });
    await getPortalSettings();
    expect(mockFrom).toHaveBeenCalledTimes(1);

    // Invalidate and change the mock response
    invalidateSettingsCache();
    mockDbRow({ n8n_base_url: 'https://v2.example.com' });

    const settings = await getPortalSettings();
    expect(settings.n8n_base_url).toBe('https://v2.example.com');
    expect(mockFrom).toHaveBeenCalledTimes(2);
  });
});
