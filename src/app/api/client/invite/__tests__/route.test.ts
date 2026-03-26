import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetIn: 60000 }),
  isValidEmail: vi.fn().mockReturnValue(true),
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
  },
}));

import { POST, GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePost(body: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/client/invite', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeGet(token = 'valid-token') {
  return new NextRequest('http://localhost/api/client/invite', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function mockAuth(user: { id: string; email: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

// Mock a simple profile fetch (single)
function mockProfileSingle(data: Record<string, any> | null) {
  const single = vi.fn().mockResolvedValue({ data, error: data ? null : { code: 'PGRST116' } });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

// Mock a maybeSingle returning null (no existing invite)
function mockNoInvite() {
  const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  const neq = vi.fn().mockReturnValue({ maybeSingle });
  const eq2 = vi.fn().mockReturnValue({ neq });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}

// Mock insert success for client_invites
function mockInsertInvite() {
  const single = vi.fn().mockResolvedValue({ data: { id: 'inv-001', token: 'ci_test' }, error: null });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { insert };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123', email: 'agency@test.com' });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/client/invite', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/invite', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost({ email: 'client@test.com' }) as any)).status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 60000 });
    expect((await POST(makePost({ email: 'client@test.com' }) as any)).status).toBe(429);
  });

  it('returns 404 when profile not found', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockProfileSingle(null));
    expect((await POST(makePost({ email: 'client@test.com' }) as any)).status).toBe(404);
  });

  it('returns 400 for invalid email', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockProfileSingle({ tier: 'pro', full_name: 'Agency' }));
    const { isValidEmail } = await import('@/lib/validation');
    (isValidEmail as any).mockReturnValueOnce(false);
    const res = await POST(makePost({ email: 'bad-email' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when inviting yourself', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockProfileSingle({ tier: 'pro', full_name: 'Agency' }));
    const res = await POST(makePost({ email: 'agency@test.com' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('yourself');
  });

  it('returns 201/200 on successful invite creation', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockProfileSingle({ tier: 'pro', full_name: 'Agency Name', agency_smtp_enabled: false });
      // Existing invite from same user — none
      if (call === 2) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const eq3 = vi.fn().mockReturnValue({ maybeSingle });
        const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // Existing invite from other users — none
      if (call === 3) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const neq = vi.fn().mockReturnValue({ maybeSingle });
        const eq2 = vi.fn().mockReturnValue({ neq });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // Insert invite
      return mockInsertInvite();
    });

    const res = await POST(makePost({ email: 'new-client@test.com' }) as any);
    expect([200, 201]).toContain(res.status);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/client/invite', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/invite');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet() as any)).status).toBe(401);
  });

  it('returns 200 with invite list', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // Sent invites: select → eq → order
        const order = vi.fn().mockResolvedValue({ data: [{ id: 'inv-1', email: 'client@test.com', invited_by: 'user-123' }], error: null });
        const eq = vi.fn().mockReturnValue({ order });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 2) {
        // Accepted invites: select → eq('accepted_by') → neq('invited_by') → order
        const order = vi.fn().mockResolvedValue({ data: [], error: null });
        const neq = vi.fn().mockReturnValue({ order });
        const eq1 = vi.fn().mockReturnValue({ neq });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      return { select: vi.fn() };
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.invites)).toBe(true);
    expect(body.invites).toHaveLength(1);
  });

  it('returns 500 when sent invites query fails', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGet() as any);
    expect(res.status).toBe(500);
  });
});
