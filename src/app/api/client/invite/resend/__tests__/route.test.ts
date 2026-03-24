import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/validation', () => ({
  isValidUUID: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/config', () => ({
  buildAppUrl: vi.fn((path: string) => `https://app.example.com${path}`),
}));
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));
vi.mock('@/lib/emailService', () => ({
  emailService: {
    sendClientAccessGrant: vi.fn().mockResolvedValue(undefined),
    sendClientInvitation: vi.fn().mockResolvedValue(undefined),
  },
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INVITE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makePost(body: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/client/invite/resend', {
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

// Mock the Promise.all two queries
function mockInviteAndProfile(
  invite: Record<string, any> | null,
  profile: Record<string, any> | null = { full_name: 'Agency' }
) {
  let call = 0;
  mockSupabaseAdmin.from.mockImplementation(() => {
    call++;
    if (call === 1) {
      // client_invites: select → eq → eq → maybeSingle
      const maybeSingle = vi.fn().mockResolvedValue({ data: invite, error: null });
      const eq2 = vi.fn().mockReturnValue({ maybeSingle });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    }
    // profiles: select → eq → maybeSingle
    const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    return { select };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/client/invite/resend', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/invite/resend', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost({ inviteId: INVITE_ID }) as any)).status).toBe(401);
  });

  it('returns 400 when inviteId is missing', async () => {
    const res = await POST(makePost({}) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('required');
  });

  it('returns 400 for invalid UUID', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    (isValidUUID as any).mockReturnValueOnce(false);
    const res = await POST(makePost({ inviteId: 'bad' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 404 when invite not found', async () => {
    mockInviteAndProfile(null);
    const res = await POST(makePost({ inviteId: INVITE_ID }) as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 when invite is already accepted', async () => {
    mockInviteAndProfile({ id: INVITE_ID, status: 'accepted', email: 'c@test.com', instance_id: null });
    const res = await POST(makePost({ inviteId: INVITE_ID }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('accepted');
  });

  it('returns 200 on successful resend (agency-paid with instance_id)', async () => {
    mockInviteAndProfile({ id: INVITE_ID, status: 'pending', email: 'c@test.com', instance_id: 'inst-1' });
    // Update: update → eq
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call <= 2) {
        if (call === 1) {
          const maybeSingle = vi.fn().mockResolvedValue({ data: { id: INVITE_ID, status: 'pending', email: 'c@test.com', instance_id: 'inst-1' }, error: null });
          const eq2 = vi.fn().mockReturnValue({ maybeSingle });
          const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
          const select = vi.fn().mockReturnValue({ eq: eq1 });
          return { select };
        }
        // profiles
        const maybeSingle = vi.fn().mockResolvedValue({ data: { full_name: 'Agency' }, error: null });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // update invite: update → eq
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq });
      return { update };
    });

    const res = await POST(makePost({ inviteId: INVITE_ID }) as any);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
