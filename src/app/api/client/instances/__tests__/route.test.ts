import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/validation', () => ({
  isValidUUID: vi.fn((id: string) => /^[0-9a-f-]{36}$/.test(id)),
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetIn: 60000 }),
}));
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));

import { GET, POST, DELETE } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CLIENT_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

function makeGet(token = 'valid-token') {
  return new NextRequest('http://localhost/api/client/instances', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function makePost(body: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/client/instances', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDelete(body: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/client/instances', {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

describe('GET /api/client/instances', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/instances');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet() as any)).status).toBe(401);
  });

  it('returns 200 with instances on success', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // client_instances query (Promise.all first): .select(...).eq('invited_by')
        const eq = vi.fn().mockResolvedValue({ data: [], error: null });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 2) {
        // pay_per_instance_deployments query (Promise.all second): .select(...).eq(...).is(...)
        const is = vi.fn().mockResolvedValue({ data: [], error: null });
        const eq = vi.fn().mockReturnValue({ is });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 3) {
        // client_invites accepted: .select(...).eq('invited_by').eq('status', 'accepted')
        const eq2 = vi.fn().mockResolvedValue({ data: [], error: null });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      if (call === 4) {
        // client_invites pending: .select(...).eq('invited_by').eq('status', 'pending')
        const eq2 = vi.fn().mockResolvedValue({ data: [], error: null });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.instances)).toBe(true);
  });

  it('returns 500 when client_instances query fails', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        const eq = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      const is = vi.fn().mockResolvedValue({ data: [], error: null });
      const eq = vi.fn().mockReturnValue({ is });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await GET(makeGet() as any);
    expect(res.status).toBe(500);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/client/instances', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/instances', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost({ instance_id: INSTANCE_ID, client_user_id: CLIENT_USER_ID }) as any)).status).toBe(401);
  });

  it('returns 400 when instance_id is missing', async () => {
    const res = await POST(makePost({ client_user_id: CLIENT_USER_ID }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when client_user_id is invalid UUID', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    // First call (instance_id) passes, second call (client_user_id) fails
    (isValidUUID as any).mockReturnValueOnce(true).mockReturnValueOnce(false);
    const res = await POST(makePost({ instance_id: INSTANCE_ID, client_user_id: 'bad' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
    const res = await POST(makePost({ instance_id: INSTANCE_ID, client_user_id: CLIENT_USER_ID }) as any);
    expect(res.status).toBe(429);
  });

  it('returns 403 when agency does not own the instance', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // pay_per_instance_deployments — not owned
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const is = vi.fn().mockReturnValue({ maybeSingle });
        const or = vi.fn().mockReturnValue({ is });
        const eq = vi.fn().mockReturnValue({ or });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      return { select: vi.fn() };
    });

    const res = await POST(makePost({ instance_id: INSTANCE_ID, client_user_id: CLIENT_USER_ID }) as any);
    expect(res.status).toBe(403);
  });

  it('returns 200 on successful assignment', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // Agency owns the instance
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: INSTANCE_ID }, error: null });
        const is = vi.fn().mockReturnValue({ maybeSingle });
        const or = vi.fn().mockReturnValue({ is });
        const eq = vi.fn().mockReturnValue({ or });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 2) {
        // Not already assigned: .select('id, user_id').eq('instance_id').maybeSingle()
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // Insert
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const res = await POST(makePost({ instance_id: INSTANCE_ID, client_user_id: CLIENT_USER_ID }) as any);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/client/instances', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/instances', { method: 'DELETE' });
    expect((await DELETE(req as any)).status).toBe(401);
  });

  it('returns 400 when instance_id is invalid', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    (isValidUUID as any).mockReturnValueOnce(false);
    const res = await DELETE(makeDelete({ instance_id: 'bad', user_id: CLIENT_USER_ID }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful revocation', async () => {
    const eq3 = vi.fn().mockResolvedValue({ error: null });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const del = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ delete: del });

    const res = await DELETE(makeDelete({ instance_id: INSTANCE_ID, user_id: CLIENT_USER_ID }) as any);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
