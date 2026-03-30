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
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INVITE_ID = 'inv-aaaa-aaaa-aaaa-aaaaaaaaaaa1';

function makePost(inviteId = INVITE_ID, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/client/invite/${inviteId}/cancel`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

function mockInviteLookup(data: Record<string, any> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: data ? null : null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

describe('POST /api/client/invite/[inviteId]/cancel', () => {
  it('returns 400 for invalid UUID', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    (isValidUUID as any).mockReturnValueOnce(false);
    const res = await POST(makePost('bad') as any, { params: Promise.resolve({ inviteId: 'bad' }) });
    expect(res.status).toBe(400);
  });

  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/client/invite/${INVITE_ID}/cancel`, { method: 'POST' });
    expect((await POST(req as any, { params: Promise.resolve({ inviteId: INVITE_ID }) })).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost() as any, { params: Promise.resolve({ inviteId: INVITE_ID }) })).status).toBe(401);
  });

  it('returns 404 when invite not found', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockInviteLookup(null));
    const res = await POST(makePost() as any, { params: Promise.resolve({ inviteId: INVITE_ID }) });
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not the inviter', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockInviteLookup({
      id: INVITE_ID,
      invited_by: 'other-user',
      status: 'pending',
      instance_id: null,
    }));
    const res = await POST(makePost() as any, { params: Promise.resolve({ inviteId: INVITE_ID }) });
    expect(res.status).toBe(403);
  });

  it('returns 400 when invite status is not pending or accepted', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockInviteLookup({
      id: INVITE_ID,
      invited_by: 'user-123',
      status: 'revoked',
      instance_id: null,
    }));
    const res = await POST(makePost() as any, { params: Promise.resolve({ inviteId: INVITE_ID }) });
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful cancellation', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        return mockInviteLookup({ id: INVITE_ID, invited_by: 'user-123', status: 'pending', instance_id: null });
      }
      // delete: delete → eq
      const eq = vi.fn().mockResolvedValue({ error: null });
      const del = vi.fn().mockReturnValue({ eq });
      return { delete: del };
    });

    const res = await POST(makePost() as any, { params: Promise.resolve({ inviteId: INVITE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
