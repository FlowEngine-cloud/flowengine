import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock dependencies before importing the route ────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const getUser = vi.fn();
  const from = vi.fn();
  const mockSupabaseAdmin = { auth: { getUser }, from };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((text: string) => `encrypted:${text}`),
}));

vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 4, resetIn: 60000 }),
}));

import { POST, DELETE } from '../stripe-key/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: 'POST' | 'DELETE', body?: Record<string, any>, token = 'valid-token'): Request {
  return new Request('http://localhost/api/agency/stripe-key', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

function mockProfile(exists: boolean) {
  const maybeSingle = vi.fn().mockResolvedValue({
    data: exists ? { id: 'user-profile-id' } : null,
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

function mockUpdate(error?: { message: string }) {
  const eq = vi.fn().mockResolvedValue({ error: error ?? null });
  const update = vi.fn().mockReturnValue({ eq });
  return { update };
}

function mockStripeApiResponse(ok: boolean, errorMessage?: string) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok,
    json: async () => ok ? {} : { error: { message: errorMessage || 'Invalid key' } },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  mockAuth({ id: 'user-123' });
});

// ─── POST (save key) ──────────────────────────────────────────────────────────

describe('POST /api/agency/stripe-key', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = new Request('http://localhost/api/agency/stripe-key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: 'sk_test_abc' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth(null);
    const res = await POST(makeRequest('POST', { apiKey: 'sk_test_abc' }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 404 when user profile does not exist', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockProfile(false));
    const res = await POST(makeRequest('POST', { apiKey: 'sk_test_validkey' }) as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 when apiKey is missing', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockProfile(true));
    const res = await POST(makeRequest('POST', {}) as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/api key is required/i);
  });

  it('returns 400 for invalid Stripe key format', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockProfile(true));
    const res = await POST(makeRequest('POST', { apiKey: 'invalid_key_format' }) as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/invalid stripe api key format/i);
  });

  it('accepts sk_live_ prefixed keys', async () => {
    mockStripeApiResponse(true);
    let callCount = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockProfile(true);
      return mockUpdate();
    });
    const res = await POST(makeRequest('POST', { apiKey: 'sk_live_validkey123' }) as any);
    expect(res.status).toBe(200);
  });

  it('accepts sk_test_ prefixed keys', async () => {
    mockStripeApiResponse(true);
    let callCount = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockProfile(true);
      return mockUpdate();
    });
    const res = await POST(makeRequest('POST', { apiKey: 'sk_test_validkey456' }) as any);
    expect(res.status).toBe(200);
  });

  it('returns 400 when Stripe API rejects the key', async () => {
    mockStripeApiResponse(false, 'No such API key');
    mockSupabaseAdmin.from.mockReturnValue(mockProfile(true));
    const res = await POST(makeRequest('POST', { apiKey: 'sk_live_badkey' }) as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/no such api key/i);
  });

  it('saves the encrypted key on success', async () => {
    mockStripeApiResponse(true);
    let capturedUpdate: Record<string, any> = {};
    let callCount = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockProfile(true);
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockImplementation((data) => {
        capturedUpdate = data;
        return { eq };
      });
      return { update };
    });

    await POST(makeRequest('POST', { apiKey: 'sk_test_abc123' }) as any);
    expect(capturedUpdate.agency_stripe_key_encrypted).toBe('encrypted:sk_test_abc123');
    expect(capturedUpdate.agency_stripe_key_set).toBe(true);
  });

  it('returns success message on valid key', async () => {
    mockStripeApiResponse(true);
    let callCount = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockProfile(true);
      return mockUpdate();
    });

    const res = await POST(makeRequest('POST', { apiKey: 'sk_live_validkey' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.message).toMatch(/saved successfully/i);
  });

  it('returns 500 when DB update fails', async () => {
    mockStripeApiResponse(true);
    let callCount = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return mockProfile(true);
      return mockUpdate({ message: 'DB write error' });
    });

    const res = await POST(makeRequest('POST', { apiKey: 'sk_live_validkey' }) as any);
    expect(res.status).toBe(500);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 30000 });

    mockSupabaseAdmin.from.mockReturnValue(mockProfile(true));
    const res = await POST(makeRequest('POST', { apiKey: 'sk_test_any' }) as any);
    expect(res.status).toBe(429);
  });
});

// ─── DELETE (remove key) ──────────────────────────────────────────────────────

describe('DELETE /api/agency/stripe-key', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = new Request('http://localhost/api/agency/stripe-key', { method: 'DELETE' });
    const res = await DELETE(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth(null);
    const res = await DELETE(makeRequest('DELETE') as any);
    expect(res.status).toBe(401);
  });

  it('clears the Stripe key and returns success', async () => {
    let capturedUpdate: Record<string, any> = {};
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockImplementation(data => {
      capturedUpdate = data;
      return { eq };
    });
    mockSupabaseAdmin.from.mockReturnValue({ update });

    const res = await DELETE(makeRequest('DELETE') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(capturedUpdate.agency_stripe_key_encrypted).toBeNull();
    expect(capturedUpdate.agency_stripe_key_set).toBe(false);
  });

  it('returns 500 when DB update fails', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'Write error' } });
    const update = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ update });

    const res = await DELETE(makeRequest('DELETE') as any);
    expect(res.status).toBe(500);
  });
});
