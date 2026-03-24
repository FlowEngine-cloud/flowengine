import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));

import { GET, POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_TOKEN = 'tm_abc123xyz';

function makeGet(token?: string) {
  const url = `http://localhost/api/team/accept${token ? `?token=${token}` : ''}`;
  return new NextRequest(url);
}

function makePost(body: Record<string, any>, authToken = 'bearer-token') {
  return new NextRequest('http://localhost/api/team/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${authToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockAuth(user: { id: string; email: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET – validate token ─────────────────────────────────────────────────────

describe('GET /api/team/accept – token validation', () => {
  it('returns 400 when token is missing', async () => {
    const res = await GET(makeGet() as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when token does not start with tm_', async () => {
    const res = await GET(makeGet('invalid-token') as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when invite is not found', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGet(VALID_TOKEN) as any);
    expect(res.status).toBe(404);
  });

  it('returns 410 when invite status is not pending', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // team_members query
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 'invite-1', email: 'user@test.com', role: 'editor', status: 'accepted', owner_id: 'owner-1' },
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      return { select: vi.fn() };
    });

    const res = await GET(makeGet(VALID_TOKEN) as any);
    expect(res.status).toBe(410);
  });

  it('returns 200 with invite info for valid pending invite', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // team_members query
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 'inv-1', email: 'user@test.com', role: 'editor', status: 'pending', owner_id: 'owner-1' },
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // profiles query for owner name
      const single = vi.fn().mockResolvedValue({ data: { full_name: 'Alice Owner' }, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await GET(makeGet(VALID_TOKEN) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.email).toBe('user@test.com');
    expect(body.role).toBe('editor');
    expect(body.inviterName).toBe('Alice Owner');
  });

  it('returns "Your team" when owner profile not found', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 'inv-1', email: 'user@test.com', role: 'editor', status: 'pending', owner_id: 'owner-1' },
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      const single = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await GET(makeGet(VALID_TOKEN) as any);
    const body = await res.json();
    expect(body.inviterName).toBe('Your team');
  });
});

// ─── POST – accept invitation ─────────────────────────────────────────────────

describe('POST /api/team/accept – accept invitation', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/team/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: VALID_TOKEN }),
    });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid auth token', async () => {
    mockAuth(null);
    expect((await POST(makePost({ token: VALID_TOKEN }) as any)).status).toBe(401);
  });

  it('returns 400 when body token does not start with tm_', async () => {
    mockAuth({ id: 'user-1', email: 'user@test.com' });
    const res = await POST(makePost({ token: 'not_valid_token' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when invite not found', async () => {
    mockAuth({ id: 'user-1', email: 'user@test.com' });
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await POST(makePost({ token: VALID_TOKEN }) as any);
    expect(res.status).toBe(404);
  });

  it('returns 410 when invite is already accepted', async () => {
    mockAuth({ id: 'user-1', email: 'user@test.com' });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'inv-1', email: 'user@test.com', owner_id: 'owner-1', status: 'accepted' },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await POST(makePost({ token: VALID_TOKEN }) as any);
    expect(res.status).toBe(410);
  });

  it('returns 403 when user email does not match invite email', async () => {
    mockAuth({ id: 'user-1', email: 'wrong@email.com' });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'inv-1', email: 'correct@email.com', owner_id: 'owner-1', status: 'pending' },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await POST(makePost({ token: VALID_TOKEN }) as any);
    expect(res.status).toBe(403);
  });

  it('returns 400 when user tries to join their own team', async () => {
    mockAuth({ id: 'owner-1', email: 'owner@test.com' });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'inv-1', email: 'owner@test.com', owner_id: 'owner-1', status: 'pending' },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await POST(makePost({ token: VALID_TOKEN }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('own team');
  });

  it('returns 409 when user is already a member of another team', async () => {
    mockAuth({ id: 'user-1', email: 'user@test.com' });

    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // Invite lookup
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 'inv-1', email: 'user@test.com', owner_id: 'owner-1', status: 'pending' },
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // Existing membership check
      const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'existing-member' }, error: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const eq2 = vi.fn().mockReturnValue({ limit });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await POST(makePost({ token: VALID_TOKEN }) as any);
    expect(res.status).toBe(409);
  });

  it('returns 200 on successful accept', async () => {
    mockAuth({ id: 'user-1', email: 'user@test.com' });

    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // Invite lookup
        const maybeSingle = vi.fn().mockResolvedValue({
          data: { id: 'inv-1', email: 'user@test.com', owner_id: 'owner-1', status: 'pending' },
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 2) {
        // Existing membership check — not a member
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const limit = vi.fn().mockReturnValue({ maybeSingle });
        const eq2 = vi.fn().mockReturnValue({ limit });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // Update invite
      const eq2 = vi.fn().mockResolvedValue({ error: null });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const update = vi.fn().mockReturnValue({ eq: eq1 });
      return { update };
    });

    const res = await POST(makePost({ token: VALID_TOKEN }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.redirectTo).toBe('/portal');
  });
});
