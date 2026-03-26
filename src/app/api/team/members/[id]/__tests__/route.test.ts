import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/teamUtils', () => ({
  getEffectiveOwnerId: vi.fn().mockResolvedValue({ ownerId: 'user-123', role: 'owner', isTeamMember: false }),
  canManageTeam: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/validation', () => ({
  isValidUUID: vi.fn((id: string) => /^[0-9a-f-]{36}$/.test(id)),
}));

import { DELETE, PATCH } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_ID = '11111111-1111-1111-1111-111111111111';

function makeDelete(id = VALID_ID, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/team/members/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
}

function makePatch(id = VALID_ID, body: Record<string, any> = { role: 'manager' }, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/team/members/${id}`, {
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

describe('DELETE /api/team/members/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/team/members/${VALID_ID}`, { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: VALID_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    const res = await DELETE(makeDelete() as any, { params: Promise.resolve({ id: VALID_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid UUID', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    (isValidUUID as any).mockReturnValueOnce(false);
    const res = await DELETE(makeDelete('not-a-uuid') as any, { params: Promise.resolve({ id: 'not-a-uuid' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Invalid');
  });

  it('returns 403 when user cannot manage team', async () => {
    const { canManageTeam } = await import('@/lib/teamUtils');
    (canManageTeam as any).mockReturnValueOnce(false);
    const res = await DELETE(makeDelete() as any, { params: Promise.resolve({ id: VALID_ID }) });
    expect(res.status).toBe(403);
  });

  it('returns 200 on successful removal', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockUpdateSuccess());
    const res = await DELETE(makeDelete() as any, { params: Promise.resolve({ id: VALID_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 when db update fails', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ update });

    const res = await DELETE(makeDelete() as any, { params: Promise.resolve({ id: VALID_ID }) });
    expect(res.status).toBe(500);
  });
});

// ─── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/team/members/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/team/members/${VALID_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'manager' }),
    });
    const res = await PATCH(req as any, { params: Promise.resolve({ id: VALID_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    const res = await PATCH(makePatch() as any, { params: Promise.resolve({ id: VALID_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid UUID', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    (isValidUUID as any).mockReturnValueOnce(false);
    const res = await PATCH(makePatch('bad') as any, { params: Promise.resolve({ id: 'bad' }) });
    expect(res.status).toBe(400);
  });

  it('returns 403 when user cannot manage team', async () => {
    const { canManageTeam } = await import('@/lib/teamUtils');
    (canManageTeam as any).mockReturnValueOnce(false);
    const res = await PATCH(makePatch() as any, { params: Promise.resolve({ id: VALID_ID }) });
    expect(res.status).toBe(403);
  });

  it('returns 400 for invalid role', async () => {
    const res = await PATCH(makePatch(VALID_ID, { role: 'superadmin' }) as any, { params: Promise.resolve({ id: VALID_ID }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('role');
  });

  it('returns 200 on successful role update', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockUpdateSuccess());
    const res = await PATCH(makePatch() as any, { params: Promise.resolve({ id: VALID_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('accepts all valid roles', async () => {
    for (const role of ['member', 'manager', 'admin']) {
      mockSupabaseAdmin.from.mockReturnValue(mockUpdateSuccess());
      const res = await PATCH(makePatch(VALID_ID, { role }) as any, { params: Promise.resolve({ id: VALID_ID }) });
      expect(res.status).toBe(200);
    }
  });

  it('returns 500 when db update fails', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ update });

    const res = await PATCH(makePatch() as any, { params: Promise.resolve({ id: VALID_ID }) });
    expect(res.status).toBe(500);
  });
});
