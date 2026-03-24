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
}));
vi.mock('@/lib/config', () => ({
  buildAppUrl: vi.fn((path: string) => `https://app.example.com${path}`),
}));
vi.mock('@/lib/emailService', () => ({
  emailService: { sendTeamMemberInvite: vi.fn().mockResolvedValue(undefined) },
}));

import { GET, POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CLIENT_ID = 'client-111';

function makeGet(clientId?: string, token = 'valid-token') {
  const url = `http://localhost/api/client/team${clientId ? `?clientId=${clientId}` : ''}`;
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function makePost(body: Record<string, any>, token = 'valid-token') {
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

// Mock verifyAgencyClientRelation — from('pay_per_instance_deployments') select → eq → eq → limit
function mockAgencyRelation(hasRelation: boolean) {
  const limit = vi.fn().mockResolvedValue({ data: hasRelation ? [{ id: 'inst-1' }] : [], error: null });
  const eq2 = vi.fn().mockReturnValue({ limit });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
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
    // verifyAgencyClientRelation: no relation
    mockSupabaseAdmin.from.mockReturnValue(mockAgencyRelation(false));
    const res = await GET(makeGet(CLIENT_ID) as any);
    expect(res.status).toBe(403);
  });

  it('returns 200 with members when user is agency', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        return mockAgencyRelation(true);
      }
      // team_members: select → eq → neq → order
      const order = vi.fn().mockResolvedValue({
        data: [{ id: 'mem-1', email: 'member@test.com', role: 'member', status: 'accepted' }],
        error: null,
      });
      const neq = vi.fn().mockReturnValue({ order });
      const eq = vi.fn().mockReturnValue({ neq });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
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
    const res = await POST(makePost({ clientId: CLIENT_ID, email: 'x@x.com' }) as any);
    expect(res.status).toBe(429);
  });

  it('returns 400 when clientId is missing', async () => {
    const res = await POST(makePost({ email: 'x@x.com' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('clientId');
  });

  it('returns 403 when user has no access', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockAgencyRelation(false));
    const res = await POST(makePost({ clientId: CLIENT_ID, email: 'x@x.com' }) as any);
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid email', async () => {
    const { isValidEmail } = await import('@/lib/validation');
    (isValidEmail as any).mockReturnValueOnce(false);
    mockSupabaseAdmin.from.mockReturnValue(mockAgencyRelation(true));
    const res = await POST(makePost({ clientId: CLIENT_ID, email: 'bad-email' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('email');
  });

  it('returns 200 on successful invite (new member)', async () => {
    mockSupabaseAdmin.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: 'agency@test.com' } },
    });

    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockAgencyRelation(true);
      if (call === 2) {
        // check existing: select → eq → eq → maybeSingle → null
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      if (call === 3) {
        // insert: insert
        const insert = vi.fn().mockResolvedValue({ error: null });
        return { insert };
      }
      // profiles: select → eq → single
      const single = vi.fn().mockResolvedValue({ data: { full_name: 'Client' }, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await POST(makePost({ clientId: CLIENT_ID, email: 'new@test.com', role: 'member' }) as any);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 409 when email already invited', async () => {
    mockSupabaseAdmin.auth.admin.getUserById.mockResolvedValue({
      data: { user: { email: 'agency@test.com' } },
    });

    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockAgencyRelation(true);
      // existing: status = 'pending' (not 'removed')
      const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'mem-1', status: 'pending' }, error: null });
      const eq2 = vi.fn().mockReturnValue({ maybeSingle });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await POST(makePost({ clientId: CLIENT_ID, email: 'already@test.com', role: 'member' }) as any);
    expect(res.status).toBe(409);
  });
});
