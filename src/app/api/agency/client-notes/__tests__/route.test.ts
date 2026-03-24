import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));
vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 19, resetIn: 60000 }),
}));

import { NextRequest } from 'next/server';
import { GET, PUT } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGetRequest(searchParams = '', token = 'valid-token') {
  return new NextRequest(`http://localhost/api/agency/client-notes${searchParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function makePutRequest(body?: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/agency/client-notes', {
    method: 'PUT',
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

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── GET tests ────────────────────────────────────────────────────────────────

describe('GET /api/agency/client-notes', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/agency/client-notes?clientUserId=abc');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth(null);
    const res = await GET(makeGetRequest('?clientUserId=abc') as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when clientUserId is missing', async () => {
    const res = await GET(makeGetRequest() as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/clientUserId/i);
  });

  it('returns notes when they exist', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { notes: 'This is a note' } });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGetRequest('?clientUserId=client-xyz') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.notes).toBe('This is a note');
  });

  it('returns empty string when no notes record exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGetRequest('?clientUserId=client-xyz') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.notes).toBe('');
  });
});

// ─── PUT tests ────────────────────────────────────────────────────────────────

describe('PUT /api/agency/client-notes', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/agency/client-notes', {
      method: 'PUT',
      body: JSON.stringify({ clientUserId: 'x', notes: 'y' }),
    });
    const res = await PUT(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth(null);
    const res = await PUT(makePutRequest({ clientUserId: 'x', notes: 'y' }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when clientUserId is missing', async () => {
    const res = await PUT(makePutRequest({ notes: 'some notes' }) as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/clientUserId/i);
  });

  it('returns 200 on successful upsert', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseAdmin.from.mockReturnValue({ upsert });

    const res = await PUT(makePutRequest({ clientUserId: 'client-xyz', notes: 'Updated notes' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 when upsert fails', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    mockSupabaseAdmin.from.mockReturnValue({ upsert });

    const res = await PUT(makePutRequest({ clientUserId: 'client-xyz', notes: 'x' }) as any);
    expect(res.status).toBe(500);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 30000 });

    const res = await PUT(makePutRequest({ clientUserId: 'x', notes: 'y' }) as any);
    expect(res.status).toBe(429);
  });

  it('saves empty string when notes are not provided', async () => {
    let capturedUpsert: Record<string, any> = {};
    const upsert = vi.fn().mockImplementation((data) => { capturedUpsert = data; return Promise.resolve({ error: null }); });
    mockSupabaseAdmin.from.mockReturnValue({ upsert });

    await PUT(makePutRequest({ clientUserId: 'client-xyz' }) as any);
    expect(capturedUpsert.notes).toBe('');
  });
});
