import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/teamUtils', () => ({
  getEffectiveOwnerId: vi.fn().mockResolvedValue({ ownerId: 'user-123', role: 'owner' }),
  canManageTeam: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/validation', () => ({
  isValidUUID: vi.fn((id: string) => /^[0-9a-f-]{36}$/.test(id)),
}));

import { DELETE, PATCH } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_MEMBER_ID = '11111111-1111-1111-1111-111111111111';
// Keep MEMBER_OWNER_ID different from user.id ('user-123') so isClient=false → no verifyClientHasAgency call
const MEMBER_OWNER_ID = 'client-owner-555';

function makeDelete(id = VALID_MEMBER_ID, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/client/team/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function makePatch(id = VALID_MEMBER_ID, body: Record<string, any> = { role: 'manager' }, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/client/team/${id}`, {
    method: 'PATCH',
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

// Mock getMemberOwnerId lookup
function mockMemberLookup(ownerId: string | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: ownerId ? { owner_id: ownerId } : null, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

// Mock agency-client relation + verifyClientHasAgency: both queries
function mockRelationCheck(isAgency: boolean, hasAgency = false) {
  let call = 0;
  mockSupabaseAdmin.from.mockImplementation(() => {
    call++;
    // 1st call: getMemberOwnerId
    if (call === 1) return mockMemberLookup(MEMBER_OWNER_ID);
    // 2nd call: verifyAgencyClientRelation
    if (call === 2) {
      const limit = vi.fn().mockResolvedValue({ data: isAgency ? [{ id: '1' }] : [], error: null });
      const eq2 = vi.fn().mockReturnValue({ limit });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    }
    // 3rd call (optional): verifyClientHasAgency
    const limit = vi.fn().mockResolvedValue({ data: hasAgency ? [{ id: '1' }] : [], error: null });
    const eq = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ eq });
    return { select };
  });
}

// Mock final update
function mockUpdateSuccess() {
  const eq2 = vi.fn().mockResolvedValue({ error: null });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const update = vi.fn().mockReturnValue({ eq: eq1 });
  return { update };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/client/team/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/client/team/${VALID_MEMBER_ID}`, { method: 'DELETE' });
    expect((await DELETE(req as any, { params: Promise.resolve({ id: VALID_MEMBER_ID }) })).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await DELETE(makeDelete() as any, { params: Promise.resolve({ id: VALID_MEMBER_ID }) })).status).toBe(401);
  });

  it('returns 400 for invalid UUID', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    (isValidUUID as any).mockReturnValueOnce(false);
    const res = await DELETE(makeDelete('bad') as any, { params: Promise.resolve({ id: 'bad' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when member not found', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockMemberLookup(null));
    const res = await DELETE(makeDelete() as any, { params: Promise.resolve({ id: VALID_MEMBER_ID }) });
    expect(res.status).toBe(404);
  });

  it('returns 403 when caller has no relation', async () => {
    mockRelationCheck(false, false);
    const res = await DELETE(makeDelete() as any, { params: Promise.resolve({ id: VALID_MEMBER_ID }) });
    expect(res.status).toBe(403);
  });

  it('returns 200 on successful removal (agency)', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockMemberLookup(MEMBER_OWNER_ID);
      if (call === 2) {
        // verifyAgencyClientRelation — agency matches
        const limit = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
        const eq2 = vi.fn().mockReturnValue({ limit });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // final update
      return mockUpdateSuccess();
    });

    const res = await DELETE(makeDelete() as any, { params: Promise.resolve({ id: VALID_MEMBER_ID }) });
    expect((await res.json()).success).toBe(true);
    expect(res.status).toBe(200);
  });
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/client/team/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/client/team/${VALID_MEMBER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'manager' }),
    });
    expect((await PATCH(req as any, { params: Promise.resolve({ id: VALID_MEMBER_ID }) })).status).toBe(401);
  });

  it('returns 400 for invalid role', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockMemberLookup(MEMBER_OWNER_ID);
      const limit = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
      const eq2 = vi.fn().mockReturnValue({ limit });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await PATCH(makePatch(VALID_MEMBER_ID, { role: 'superuser' }) as any, { params: Promise.resolve({ id: VALID_MEMBER_ID }) });
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful role update (agency)', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockMemberLookup(MEMBER_OWNER_ID);
      if (call === 2) {
        const limit = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
        const eq2 = vi.fn().mockReturnValue({ limit });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      return mockUpdateSuccess();
    });

    const res = await PATCH(makePatch() as any, { params: Promise.resolve({ id: VALID_MEMBER_ID }) });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
