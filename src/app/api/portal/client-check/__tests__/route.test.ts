import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseAdmin),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGet(token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  return { headers: { get: (h: string) => headers[h] ?? null } } as any;
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({ data: { user } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/portal/client-check', () => {
  it('returns isClient:false without token', async () => {
    const res = await GET(makeGet());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.isClient).toBe(false);
    expect(body.instances).toEqual([]);
  });

  it('returns isClient:false for invalid user', async () => {
    mockAuth(null);
    const res = await GET(makeGet('invalid'));
    const body = await res.json();
    expect(body.isClient).toBe(false);
  });

  it('returns isClient:false when user has no client instances', async () => {
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGet('valid-token'));
    const body = await res.json();
    expect(body.isClient).toBe(false);
    expect(body.allowFullAccess).toBe(false);
    expect(body.instances).toHaveLength(0);
  });

  it('returns isClient:true with instances and allowFullAccess:false for view-only', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ instance_id: 'inst-1', invited_by: 'agency-1', access_level: 'view' }],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGet('valid-token'));
    const body = await res.json();
    expect(body.isClient).toBe(true);
    expect(body.allowFullAccess).toBe(false);
    expect(body.instances).toHaveLength(1);
  });

  it('returns allowFullAccess:true for edit-level access', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ instance_id: 'inst-1', invited_by: 'agency-1', access_level: 'edit' }],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGet('valid-token'));
    const body = await res.json();
    expect(body.allowFullAccess).toBe(true);
  });

  it('returns allowFullAccess:true for admin-level access', async () => {
    const eq = vi.fn().mockResolvedValue({
      data: [{ instance_id: 'inst-2', invited_by: 'agency-1', access_level: 'admin' }],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGet('valid-token'));
    const body = await res.json();
    expect(body.allowFullAccess).toBe(true);
  });
});
