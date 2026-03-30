import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));

vi.mock('@/lib/teamUtils', () => ({
  getEffectiveOwnerId: vi.fn().mockResolvedValue({ ownerId: 'owner-123', isTeamMember: false, role: 'owner' }),
  canManageTeam: vi.fn().mockReturnValue(true),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(token = 'valid-token') {
  return new Request('http://localhost/api/team/members', {
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

// ─── GET tests ────────────────────────────────────────────────────────────────

describe('GET /api/team/members', () => {
  it('returns 401 with no auth header', async () => {
    const req = new Request('http://localhost/api/team/members');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth(null);
    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(401);
  });

  it('returns 403 when user cannot manage team', async () => {
    const { canManageTeam } = await import('@/lib/teamUtils');
    (canManageTeam as any).mockReturnValueOnce(false);

    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(403);
  });

  it('returns list of members on success', async () => {
    const members = [
      { id: 'mem-1', email: 'a@example.com', role: 'admin', status: 'accepted' },
    ];
    const order = vi.fn().mockResolvedValue({ data: members, error: null });
    const neq = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ neq });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.members).toHaveLength(1);
    expect(body.members[0].email).toBe('a@example.com');
  });

  it('returns empty array when no members', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: null });
    const neq = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ neq });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest() as any);
    const body = await res.json();
    expect(body.members).toEqual([]);
  });

  it('returns 500 when DB query fails', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const neq = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ neq });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(500);
  });
});
