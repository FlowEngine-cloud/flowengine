import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace('enc:', '')),
}));
vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}));

// Mock global fetch for Stripe validation
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve({}),
});
vi.stubGlobal('fetch', mockFetch);

import { POST, DELETE } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePost(body: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/agency/stripe-key', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDelete(token = 'valid-token') {
  return new NextRequest('http://localhost/api/agency/stripe-key', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

function mockProfileLookup(data: { id: string } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

function mockUpdateSuccess() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  return { update };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
  mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/agency/stripe-key', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/agency/stripe-key', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost({ apiKey: 'sk_test_abc' }) as any)).status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false });
    mockSupabaseAdmin.from.mockReturnValue(mockProfileLookup({ id: 'user-123' }));
    const res = await POST(makePost({ apiKey: 'sk_test_abc' }) as any);
    expect(res.status).toBe(429);
  });

  it('returns 404 when profile not found', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockProfileLookup(null));
    const res = await POST(makePost({ apiKey: 'sk_test_abc' }) as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 when apiKey is missing', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockProfileLookup({ id: 'user-123' }));
    const res = await POST(makePost({}) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('API key is required');
  });

  it('returns 400 for invalid key format', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockProfileLookup({ id: 'user-123' }));
    const res = await POST(makePost({ apiKey: 'pk_test_wrong' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('sk_live_');
  });

  it('returns 400 when Stripe validation fails', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: () => Promise.resolve({ error: { message: 'No such API key' } }),
    });
    mockSupabaseAdmin.from.mockReturnValue(mockProfileLookup({ id: 'user-123' }));
    const res = await POST(makePost({ apiKey: 'sk_test_invalid' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful key save', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockProfileLookup({ id: 'user-123' });
      return mockUpdateSuccess();
    });

    const res = await POST(makePost({ apiKey: 'sk_test_valid123' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/agency/stripe-key', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/agency/stripe-key', { method: 'DELETE' });
    expect((await DELETE(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await DELETE(makeDelete() as any)).status).toBe(401);
  });

  it('returns 200 on successful key removal', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockUpdateSuccess());
    const res = await DELETE(makeDelete() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
