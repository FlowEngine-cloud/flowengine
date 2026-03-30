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

// queryChain helper: builds a full select → eq → eq → limit → maybeSingle chain
function queryChain(data: unknown) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const eq2 = vi.fn().mockReturnValue({ maybeSingle, limit });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2, maybeSingle, limit });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}

// Mock agency-client relation + verifyClientHasAgency: dispatches by table name
function mockRelationCheck(isAgency: boolean, hasAgency = false) {
  mockSupabaseAdmin.from.mockImplementation((table: string) => {
    // getMemberOwnerId
    if (table === 'team_members') return mockMemberLookup(MEMBER_OWNER_ID);
    // verifyAgencyClientRelation — 3 parallel queries
    if (table === 'client_invites') return queryChain(isAgency ? { id: '1' } : null);
    if (table === 'client_instances') return queryChain(null);
    if (table === 'pay_per_instance_deployments') return queryChain(null);
    // fallback
    return queryChain(null);
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
    let teamMembersCall = 0;
    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'team_members') {
        teamMembersCall++;
        return teamMembersCall === 1 ? mockMemberLookup(MEMBER_OWNER_ID) : mockUpdateSuccess();
      }
      if (table === 'client_invites') return queryChain({ id: '1' });
      if (table === 'client_instances') return queryChain(null);
      if (table === 'pay_per_instance_deployments') return queryChain(null);
      return queryChain(null);
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
    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'team_members') return mockMemberLookup(MEMBER_OWNER_ID);
      if (table === 'client_invites') return queryChain({ id: '1' });
      if (table === 'client_instances') return queryChain(null);
      if (table === 'pay_per_instance_deployments') return queryChain(null);
      return queryChain(null);
    });

    const res = await PATCH(makePatch(VALID_MEMBER_ID, { role: 'superuser' }) as any, { params: Promise.resolve({ id: VALID_MEMBER_ID }) });
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful role update (agency)', async () => {
    let teamMembersCall = 0;
    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'team_members') {
        teamMembersCall++;
        return teamMembersCall === 1 ? mockMemberLookup(MEMBER_OWNER_ID) : mockUpdateSuccess();
      }
      if (table === 'client_invites') return queryChain({ id: '1' });
      if (table === 'client_instances') return queryChain(null);
      if (table === 'pay_per_instance_deployments') return queryChain(null);
      return queryChain(null);
    });

    const res = await PATCH(makePatch() as any, { params: Promise.resolve({ id: VALID_MEMBER_ID }) });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });
});
