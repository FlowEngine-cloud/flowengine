import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));
vi.mock('@/lib/validation', () => ({
  isValidUUID: vi.fn().mockReturnValue(true),
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makePost(instanceId = INSTANCE_ID, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/client/instances/${instanceId}/revoke`, {
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

function mockInstanceLookup(data: Record<string, any> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/client/instances/[id]/revoke', () => {
  it('returns 400 for invalid UUID', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    (isValidUUID as any).mockReturnValueOnce(false);
    const res = await POST(makePost('bad') as any, { params: Promise.resolve({ id: 'bad' }) });
    expect(res.status).toBe(400);
  });

  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/client/instances/${INSTANCE_ID}/revoke`, { method: 'POST' });
    expect((await POST(req as any, { params: Promise.resolve({ id: INSTANCE_ID }) })).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost() as any, { params: Promise.resolve({ id: INSTANCE_ID }) })).status).toBe(401);
  });

  it('returns 404 when instance not found', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockInstanceLookup(null));
    const res = await POST(makePost() as any, { params: Promise.resolve({ id: INSTANCE_ID }) });
    expect(res.status).toBe(404);
  });

  it('returns 403 when user has no access', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockInstanceLookup({
      id: INSTANCE_ID, user_id: 'other-user', invited_by_user_id: 'other-agency',
    }));
    const res = await POST(makePost() as any, { params: Promise.resolve({ id: INSTANCE_ID }) });
    expect(res.status).toBe(403);
  });

  it('returns 400 when no agency to revoke', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockInstanceLookup({
      id: INSTANCE_ID, user_id: 'user-123', invited_by_user_id: null,
    }));
    const res = await POST(makePost() as any, { params: Promise.resolve({ id: INSTANCE_ID }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('No agency access');
  });

  it('returns 200 on successful revocation (owner)', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // instance lookup
        return mockInstanceLookup({ id: INSTANCE_ID, user_id: 'user-123', invited_by_user_id: 'agency-456' });
      }
      if (call === 2) {
        // client_invites lookup: select → eq → eq → maybeSingle
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'invite-1' }, error: null });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      if (call === 3) {
        // update pay_per_instance: update → eq
        const eq = vi.fn().mockResolvedValue({ error: null });
        const update = vi.fn().mockReturnValue({ eq });
        return { update };
      }
      // delete invite: delete → eq
      const eq = vi.fn().mockResolvedValue({ error: null });
      const del = vi.fn().mockReturnValue({ eq });
      return { delete: del };
    });

    const res = await POST(makePost() as any, { params: Promise.resolve({ id: INSTANCE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.revokedBy).toBe('owner');
  });

  it('returns 200 revokedBy:agency when agency removes themselves', async () => {
    const { resolveEffectiveUserId } = await import('@/lib/teamAccess');
    (resolveEffectiveUserId as any).mockResolvedValueOnce('agency-456');

    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        return mockInstanceLookup({ id: INSTANCE_ID, user_id: 'client-user', invited_by_user_id: 'agency-456' });
      }
      if (call === 2) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // update
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq });
      return { update };
    });

    const res = await POST(makePost() as any, { params: Promise.resolve({ id: INSTANCE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.revokedBy).toBe('agency');
  });
});
