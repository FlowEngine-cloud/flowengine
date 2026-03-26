import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn(), admin: { getUserById: vi.fn() } }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetIn: 60000 }),
  isValidEmail: vi.fn((email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
}));
vi.mock('@/lib/config', () => ({
  buildAppUrl: vi.fn((path: string) => `https://app.example.com${path}`),
}));
vi.mock('@/lib/teamUtils', () => ({
  getEffectiveOwnerId: vi.fn().mockResolvedValue({ ownerId: 'user-123', role: 'owner', isTeamMember: false }),
  canManageTeam: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/emailService', () => ({
  emailService: {
    sendTeamMemberInvite: vi.fn().mockResolvedValue(undefined),
  },
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePost(body: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/team/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockAuth(user: { id: string; email: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

function mockProfileSingle(data: Record<string, any> | null) {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

function mockNoExistingInvite() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const eq2 = vi.fn().mockReturnValue({ maybeSingle });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}

function mockInsertSuccess() {
  const error = null;
  const insert = vi.fn().mockResolvedValue({ error });
  return { insert };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123', email: 'owner@test.com' });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('POST /api/team/invite – auth', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/team/invite', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com' }),
    });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost({ email: 'user@test.com' }) as any)).status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
    const res = await POST(makePost({ email: 'user@test.com' }) as any);
    expect(res.status).toBe(429);
  });
});

// ─── Permission checks ────────────────────────────────────────────────────────

describe('POST /api/team/invite – permissions', () => {
  it('returns 403 when user cannot manage team', async () => {
    const { canManageTeam } = await import('@/lib/teamUtils');
    (canManageTeam as any).mockReturnValueOnce(false);
    const res = await POST(makePost({ email: 'user@test.com' }) as any);
    expect(res.status).toBe(403);
  });
});

// ─── Input validation ─────────────────────────────────────────────────────────

describe('POST /api/team/invite – input validation', () => {
  beforeEach(() => {
    // Profile lookup mock (needed before body parsing)
    mockSupabaseAdmin.from.mockReturnValue(mockProfileSingle({ tier: 'pro', full_name: 'Owner' }));
  });

  it('returns 400 for invalid email format', async () => {
    const { isValidEmail } = await import('@/lib/validation');
    (isValidEmail as any).mockReturnValueOnce(false);
    const res = await POST(makePost({ email: 'not-an-email', role: 'member' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid role', async () => {
    const res = await POST(makePost({ email: 'user@test.com', role: 'superadmin' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('role');
  });

  it('returns 400 when inviting yourself', async () => {
    const res = await POST(makePost({ email: 'owner@test.com', role: 'member' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('yourself');
  });
});

// ─── Duplicate detection ──────────────────────────────────────────────────────

describe('POST /api/team/invite – duplicate detection', () => {
  it('returns 409 when email is already invited', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockProfileSingle({ tier: 'pro', full_name: 'Owner' });
      // team_members lookup - returns existing active invite
      const maybeSingle = vi.fn().mockResolvedValue({
        data: { id: 'inv-1', status: 'pending' },
        error: null,
      });
      const eq2 = vi.fn().mockReturnValue({ maybeSingle });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await POST(makePost({ email: 'already@invited.com', role: 'member' }) as any);
    expect(res.status).toBe(409);
  });
});

// ─── Successful invite ────────────────────────────────────────────────────────

describe('POST /api/team/invite – success', () => {
  it('returns 200 when invite is created successfully', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockProfileSingle({ tier: 'pro', full_name: 'Owner' });
      if (call === 2) return mockNoExistingInvite();
      return mockInsertSuccess();
    });

    const res = await POST(makePost({ email: 'newuser@test.com', role: 'member' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('sends invite email on success', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockProfileSingle({ tier: 'pro', full_name: 'Owner' });
      if (call === 2) return mockNoExistingInvite();
      return mockInsertSuccess();
    });

    await POST(makePost({ email: 'newuser@test.com', role: 'member' }) as any);

    const { emailService } = await import('@/lib/emailService');
    expect(emailService.sendTeamMemberInvite).toHaveBeenCalledWith(
      'newuser@test.com',
      expect.any(String),
      'member',
      expect.stringContaining('tm_')
    );
  });

  it('still returns 200 even if email sending fails', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockProfileSingle({ tier: 'pro', full_name: 'Owner' });
      if (call === 2) return mockNoExistingInvite();
      return mockInsertSuccess();
    });

    const { emailService } = await import('@/lib/emailService');
    (emailService.sendTeamMemberInvite as any).mockRejectedValueOnce(new Error('SMTP failure'));

    const res = await POST(makePost({ email: 'newuser@test.com', role: 'member' }) as any);
    expect(res.status).toBe(200);
  });
});
