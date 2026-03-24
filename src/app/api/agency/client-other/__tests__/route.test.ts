import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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
  isValidUUID: vi.fn((id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 19, resetIn: 60000 }),
}));

import { GET, POST, PUT, DELETE } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

function makeGet(searchParams = '', token = 'valid-token') {
  return new NextRequest(`http://localhost/api/agency/client-other${searchParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function makePost(body?: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/agency/client-other', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makePut(body?: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/agency/client-other', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDelete(searchParams = '', token = 'valid-token') {
  return new NextRequest(`http://localhost/api/agency/client-other${searchParams}`, {
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

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/agency/client-other', () => {
  it('returns 401 with no auth', async () => {
    const req = new NextRequest('http://localhost/api/agency/client-other?clientUserId=x');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when clientUserId missing', async () => {
    const res = await GET(makeGet() as any);
    expect(res.status).toBe(400);
  });

  it('returns entries list on success', async () => {
    const entries = [{ id: VALID_UUID, name: 'CRM', domain: 'crm.example.com' }];
    const order = vi.fn().mockResolvedValue({ data: entries, error: null });
    const eq2 = vi.fn().mockReturnValue({ order });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGet('?clientUserId=client-x') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.entries).toHaveLength(1);
    expect(body.entries[0].name).toBe('CRM');
  });

  it('returns empty array when no entries', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn().mockReturnValue({ order });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGet('?clientUserId=client-x') as any);
    const body = await res.json();
    expect(body.entries).toEqual([]);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/agency/client-other', () => {
  it('returns 401 with no auth', async () => {
    const req = new NextRequest('http://localhost/api/agency/client-other', {
      method: 'POST',
      body: JSON.stringify({ clientUserId: 'x', name: 'CRM' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when clientUserId or name missing', async () => {
    let res = await POST(makePost({ name: 'CRM' }) as any);
    expect(res.status).toBe(400);

    res = await POST(makePost({ clientUserId: 'x' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns created entry on success', async () => {
    const newEntry = { id: VALID_UUID, name: 'CRM', domain: '' };
    const single = vi.fn().mockResolvedValue({ data: newEntry, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    mockSupabaseAdmin.from.mockReturnValue({ insert });

    const res = await POST(makePost({ clientUserId: 'client-x', name: 'CRM' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.entry.name).toBe('CRM');
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 30000 });

    const res = await POST(makePost({ clientUserId: 'x', name: 'Test' }) as any);
    expect(res.status).toBe(429);
  });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/agency/client-other', () => {
  it('returns 400 when id is invalid UUID', async () => {
    const res = await PUT(makePut({ id: 'not-uuid', name: 'Test' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when name is missing', async () => {
    const res = await PUT(makePut({ id: VALID_UUID }) as any);
    expect(res.status).toBe(400);
  });

  it('returns updated entry on success', async () => {
    const updated = { id: VALID_UUID, name: 'Updated CRM' };
    const single = vi.fn().mockResolvedValue({ data: updated, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const eq2 = vi.fn().mockReturnValue({ select });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ update });

    const res = await PUT(makePut({ id: VALID_UUID, name: 'Updated CRM' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.entry.name).toBe('Updated CRM');
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/agency/client-other', () => {
  it('returns 400 when id is missing', async () => {
    const res = await DELETE(makeDelete() as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when id is invalid UUID', async () => {
    const res = await DELETE(makeDelete('?id=bad-id') as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful delete', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const del = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ delete: del });

    const res = await DELETE(makeDelete(`?id=${VALID_UUID}`) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 when delete fails', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const del = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ delete: del });

    const res = await DELETE(makeDelete(`?id=${VALID_UUID}`) as any);
    expect(res.status).toBe(500);
  });
});
