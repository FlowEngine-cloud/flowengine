import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = {
    auth: { getUser: vi.fn(), admin: { getUserById: vi.fn() } },
    from: vi.fn(),
  };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/teamUtils', () => ({
  getEffectiveOwnerId: vi.fn().mockResolvedValue({ ownerId: 'user-123', role: 'owner' }),
  canManageTeam: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  isValidEmail: vi.fn().mockReturnValue(true),
  isValidUUID: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/config', () => ({
  buildAppUrl: vi.fn((path: string) => `https://app.example.com${path}`),
}));
vi.mock('@/lib/emailService', () => ({
  emailService: { sendTeamMemberInvite: vi.fn().mockResolvedValue(undefined) },
}));

import { GET, POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLIENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeGet(clientId?: string, token = 'valid-token') {
  const url = `http://localhost/api/client/team${clientId ? `?clientId=${clientId}` : ''}`;
  return new NextRequest(url, { headers: { Authorization: `Bearer ${token}` } });
}

function makePost(body: Record<string, unknown>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/client/team', {
    method: 'POST',
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

/**
 * Build a Supabase query chain that handles .select().eq().eq().maybeSingle()
 * and .select().eq().eq().limit().maybeSingle() — both patterns used in
 * verifyAgencyClientRelation and verifyClientHasAgency.
 */
function queryChain(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const eq2 = vi.fn().mockReturnValue({ maybeSingle, limit });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2, maybeSingle, limit });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}

/**
 * Mock verifyAgencyClientRelation (3 parallel queries: client_invites,
 * client_instances, pay_per_instance_deployments) and verifyClientHasAgency
 * (3 parallel queries: client_instances, client_invites, pay_per_instance_deployments).
 * Pass hasRelation=true to make client_invites return a hit.
 */
function makeAgencyFromMock(hasRelation: boolean) {
  return (table: string) => {
    if (table === 'client_invites') return queryChain(hasRelation ? { id: 'row-1' } : null);
    if (table === 'client_instances') return queryChain(null);
    if (table === 'pay_per_instance_deployments') return queryChain(null);
    return queryChain(null);
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/client/team', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/team?clientId=xxx');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet(CLIENT_ID) as any)).status).toBe(401);
  });

  it('returns 400 when clientId is missing', async () => {
    const res = await GET(makeGet() as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('clientId');
  });

  it('returns 403 when user is not agency or client', async () => {
    mockSupabaseAdmin.from.mockImplementation(makeAgencyFromMock(false));
    expect((await GET(makeGet(CLIENT_ID) as any)).status).toBe(403);
  });

  it('returns 200 with members when user is agency', async () => {
    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'team_members') {
        // Chain: select → neq → order → eq (awaitable)
        const eqFinal = vi.fn().mockResolvedValue({
          data: [{ id: 'mem-1', email: 'member@test.com', role: 'member', status: 'accepted' }],
          error: null,
        });
        const order = vi.fn().mockReturnValue({ eq: eqFinal });
        const neq = vi.fn().mockReturnValue({ order });
        return { select: vi.fn().mockReturnValue({ neq }) };
      }
      return makeAgencyFromMock(true)(table);
    });

    const res = await GET(makeGet(CLIENT_ID) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.members)).toBe(true);
    expect(body.members).toHaveLength(1);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/client/team', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/team', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost({ clientId: CLIENT_ID, email: 'x@x.com', role: 'member' }) as any)).status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false });
    expect((await POST(makePost({ clientId: CLIENT_ID, email: 'x@x.com' }) as any)).status).toBe(429);
  });

  it('returns 400 when clientId is missing', async () => {
    const res = await POST(makePost({ email: 'x@x.com' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('clientId');
  });

  it('returns 400 for ni_ prefixed clientId (name-only client)', async () => {
    const res = await POST(makePost({ clientId: 'ni_abc123', email: 'x@x.com' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/name-only/i);
  });

  it('returns 403 when pending client has no agency relation', async () => {
    // pending: prefix is now valid — but still needs agency/client relation check
    mockSupabaseAdmin.from.mockImplementation(makeAgencyFromMock(false));
    const res = await POST(makePost({ clientId: 'pending:abc123', email: 'x@x.com' }) as any);
    expect(res.status).toBe(403);
  });

  it('returns 403 when user has no access', async () => {
    mockSupabaseAdmin.from.mockImplementation(makeAgencyFromMock(false));
    expect((await POST(makePost({ clientId: CLIENT_ID, email: 'x@x.com' }) as any)).status).toBe(403);
  });

  it('returns 400 for invalid email', async () => {
    const { isValidEmail } = await import('@/lib/validation');
    (isValidEmail as any).mockReturnValueOnce(false);
    mockSupabaseAdmin.from.mockImplementation(makeAgencyFromMock(true));
    const res = await POST(makePost({ clientId: CLIENT_ID, email: 'bad-email' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('email');
  });

  it('returns 200 on successful invite (new member)', async () => {
    mockSupabaseAdmin.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: 'agency@test.com' } },
    });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'team_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              }),
            }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }
      if (table === 'profiles') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { full_name: 'Client' }, error: null }),
            }),
          }),
        };
      }
      return makeAgencyFromMock(true)(table);
    });

    const res = await POST(makePost({ clientId: CLIENT_ID, email: 'new@test.com', role: 'member' }) as any);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 409 when email already invited', async () => {
    mockSupabaseAdmin.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: 'agency@test.com' } },
    });

    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'team_members') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'mem-1', status: 'pending' }, error: null }),
              }),
            }),
          }),
        };
      }
      return makeAgencyFromMock(true)(table);
    });

    const res = await POST(makePost({ clientId: CLIENT_ID, email: 'already@test.com', role: 'member' }) as any);
    expect(res.status).toBe(409);
  });
});
