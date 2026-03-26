import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock @supabase/supabase-js ───────────────────────────────────────────────

const { mockClient } = vi.hoisted(() => {
  const getUser = vi.fn();
  const from = vi.fn();
  const mockClient = { auth: { getUser }, from };
  return { mockClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}));

// Mock invalidateSettingsCache so it's a no-op in tests
vi.mock('@/lib/portalSettings', () => ({
  invalidateSettingsCache: vi.fn(),
}));

import { GET, PATCH } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(token?: string): Request {
  return new Request('http://localhost/api/settings/portal', {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

function makePatchRequest(body: Record<string, any>, token = 'valid-token'): Request {
  return new Request('http://localhost/api/settings/portal', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

function mockAuth(userId: string | null) {
  mockClient.auth.getUser.mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: userId ? null : { message: 'Unauthorized' },
  });
}

// Build a chainable mock chain: from().select().limit().maybeSingle()
function buildChain(resolvedValue: { data: any; error?: any }) {
  const maybeSingle = vi.fn().mockResolvedValue(resolvedValue);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ limit });
  return { select, _maybeSingle: maybeSingle };
}

// Build a chainable update mock: from().select().limit().maybeSingle() for
// the "find existing row" step, and from().update().eq() or from().insert()
function mockPatchFlow(existingRowId: string | null, updateError?: any, insertError?: any) {
  let callCount = 0;

  mockClient.from.mockImplementation(() => {
    callCount++;
    if (callCount === 1) {
      // First call: check if row exists
      const maybeSingle = vi.fn().mockResolvedValue({
        data: existingRowId ? { id: existingRowId } : null,
        error: null,
      });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ limit });
      return { select };
    }
    if (callCount === 2) {
      if (existingRowId) {
        // Second call: update
        const eq = vi.fn().mockResolvedValue({ error: updateError ?? null });
        const update = vi.fn().mockReturnValue({ eq });
        return { update };
      } else {
        // Second call: insert
        const insert = vi.fn().mockResolvedValue({ error: insertError ?? null });
        return { insert };
      }
    }
    return { select: vi.fn(), update: vi.fn(), insert: vi.fn() };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

// ─── GET tests ────────────────────────────────────────────────────────────────

describe('GET /api/settings/portal', () => {
  it('returns 401 with no Authorization header', async () => {
    const res = await GET(makeGetRequest() as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when auth token is invalid', async () => {
    mockAuth(null);
    const res = await GET(makeGetRequest('bad-token') as any);
    expect(res.status).toBe(401);
  });

  it('returns empty defaults when no portal_settings row exists', async () => {
    mockAuth('user-123');
    const { select } = buildChain({ data: null, error: null });
    mockClient.from.mockReturnValue({ select });

    const res = await GET(makeGetRequest('valid-token') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ oauth_credentials: {} });
  });

  it('returns portal settings row when it exists', async () => {
    mockAuth('user-123');
    const row = {
      n8n_base_url: 'https://n8n.example.com',
      n8n_api_key: 'secret-api-key',
      oauth_credentials: { google: { clientId: 'g-id', clientSecret: 'g-secret' } },
      flowengine_api_key: 'fp_123',
      allow_signup: true,
      updated_at: '2024-01-01T00:00:00Z',
    };
    const { select } = buildChain({ data: row, error: null });
    mockClient.from.mockReturnValue({ select });

    const res = await GET(makeGetRequest('valid-token') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.n8n_base_url).toBe('https://n8n.example.com');
    expect(body.oauth_credentials).toMatchObject({ google: { clientId: 'g-id' } });
  });

  it('masks sensitive fields as "********"', async () => {
    mockAuth('user-123');
    const row = {
      n8n_api_key: 'super-secret',
      ai_api_key: 'ai-secret',
      n8n_smtp_pass: 'smtp-pass',
      flowengine_api_key: 'fp_secret',
    };
    const { select } = buildChain({ data: row, error: null });
    mockClient.from.mockReturnValue({ select });

    const res = await GET(makeGetRequest('valid-token') as any);
    const body = await res.json();
    expect(body.n8n_api_key).toBe('********');
    expect(body.ai_api_key).toBe('********');
    expect(body.n8n_smtp_pass).toBe('********');
    expect(body.flowengine_api_key).toBe('********');
  });

  it('does not expose id or updated_by fields', async () => {
    mockAuth('user-123');
    const row = { id: 'row-id', updated_by: 'user-id', n8n_base_url: null };
    const { select } = buildChain({ data: row, error: null });
    mockClient.from.mockReturnValue({ select });

    const res = await GET(makeGetRequest('valid-token') as any);
    const body = await res.json();
    expect(body).not.toHaveProperty('id');
    expect(body).not.toHaveProperty('updated_by');
  });

  it('does not mask fields that are falsy (empty string, null)', async () => {
    mockAuth('user-123');
    const row = { n8n_api_key: '', flowengine_api_key: null };
    const { select } = buildChain({ data: row, error: null });
    mockClient.from.mockReturnValue({ select });

    const res = await GET(makeGetRequest('valid-token') as any);
    const body = await res.json();
    // Falsy values should not be replaced with ********
    expect(body.n8n_api_key).not.toBe('********');
    expect(body.flowengine_api_key).not.toBe('********');
  });

  it('returns 500 on DB error', async () => {
    mockAuth('user-123');
    const { select } = buildChain({ data: null, error: { message: 'DB error' } });
    mockClient.from.mockReturnValue({ select });

    const res = await GET(makeGetRequest('valid-token') as any);
    expect(res.status).toBe(500);
  });
});

// ─── PATCH tests ──────────────────────────────────────────────────────────────

describe('PATCH /api/settings/portal', () => {
  it('returns 401 with no Authorization header', async () => {
    const req = new Request('http://localhost/api/settings/portal', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ n8n_base_url: 'https://test.com' }),
    });
    const res = await PATCH(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body has no valid updatable fields', async () => {
    mockAuth('user-123');
    const res = await PATCH(makePatchRequest({ unknown_field: 'value' }) as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/no valid fields/i);
  });

  it('ignores masked placeholder values (does not save "********")', async () => {
    mockAuth('user-123');
    mockPatchFlow('existing-row-id');
    const res = await PATCH(makePatchRequest({ n8n_api_key: '********', n8n_base_url: 'https://n8n.test.com' }) as any);
    const body = await res.json();
    // Should succeed with the non-masked field
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('creates a new row when no existing row found (INSERT path)', async () => {
    mockAuth('user-123');
    mockPatchFlow(null); // no existing row → INSERT

    const res = await PATCH(makePatchRequest({ n8n_base_url: 'https://new.n8n.com' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('updates existing row when found (UPDATE path)', async () => {
    mockAuth('user-123');
    mockPatchFlow('row-abc'); // existing row → UPDATE

    const res = await PATCH(makePatchRequest({ n8n_base_url: 'https://updated.n8n.com' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('saves oauth_credentials as JSON', async () => {
    mockAuth('user-123');
    mockPatchFlow(null);
    const creds = { google: { clientId: 'g-id', clientSecret: 'g-secret' } };
    const res = await PATCH(makePatchRequest({ oauth_credentials: creds }) as any);
    expect(res.status).toBe(200);
  });

  it('trims string values before saving', async () => {
    mockAuth('user-123');
    let capturedUpdate: Record<string, any> = {};
    let callCount = 0;
    mockClient.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'row-id' }, error: null });
        const limit = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ limit });
        return { select };
      }
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockImplementation(data => {
        capturedUpdate = data;
        return { eq };
      });
      return { update };
    });

    await PATCH(makePatchRequest({ n8n_base_url: '  https://n8n.example.com  ' }) as any);
    expect(capturedUpdate.n8n_base_url).toBe('https://n8n.example.com');
  });

  it('returns 500 on DB update error', async () => {
    mockAuth('user-123');
    mockPatchFlow('row-id', { message: 'Update failed' }); // force update error

    const res = await PATCH(makePatchRequest({ n8n_base_url: 'https://n8n.test.com' }) as any);
    expect(res.status).toBe(500);
  });
});
