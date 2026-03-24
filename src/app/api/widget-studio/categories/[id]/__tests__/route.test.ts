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

import { PUT, DELETE } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CAT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeReq(method: string, id = CAT_ID, body?: any, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/widget-studio/categories/${id}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/widget-studio/categories/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/widget-studio/categories/${CAT_ID}`, { method: 'PUT' });
    expect((await PUT(req as any, { params: Promise.resolve({ id: CAT_ID }) })).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    const res = await PUT(makeReq('PUT') as any, { params: Promise.resolve({ id: CAT_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid UUID', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    (isValidUUID as any).mockReturnValueOnce(false);
    const res = await PUT(makeReq('PUT', 'bad-uuid', { name: 'Test' }) as any, { params: Promise.resolve({ id: 'bad-uuid' }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Invalid');
  });

  it('returns 400 when no fields to update', async () => {
    const res = await PUT(makeReq('PUT', CAT_ID, {}) as any, { params: Promise.resolve({ id: CAT_ID }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('No fields');
  });

  it('returns 400 when name is empty string', async () => {
    const res = await PUT(makeReq('PUT', CAT_ID, { name: '  ' }) as any, { params: Promise.resolve({ id: CAT_ID }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('empty');
  });

  it('returns 404 when category not found', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq2 = vi.fn().mockReturnValue({ select });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ update });

    const res = await PUT(makeReq('PUT', CAT_ID, { name: 'Updated' }) as any, { params: Promise.resolve({ id: CAT_ID }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 with updated category on success', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: CAT_ID, name: 'Updated', description: null },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ maybeSingle });
    const eq2 = vi.fn().mockReturnValue({ select });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ update });

    const res = await PUT(makeReq('PUT', CAT_ID, { name: 'Updated', color: '#ff0000' }) as any, { params: Promise.resolve({ id: CAT_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.category.id).toBe(CAT_ID);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/widget-studio/categories/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/widget-studio/categories/${CAT_ID}`, { method: 'DELETE' });
    expect((await DELETE(req as any, { params: Promise.resolve({ id: CAT_ID }) })).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    const res = await DELETE(makeReq('DELETE') as any, { params: Promise.resolve({ id: CAT_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when category not found', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq2 = vi.fn().mockReturnValue({ maybeSingle });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await DELETE(makeReq('DELETE') as any, { params: Promise.resolve({ id: CAT_ID }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful delete', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // existence check: select → eq → eq → maybeSingle
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: CAT_ID }, error: null });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // delete: delete → eq → eq
      const eq2 = vi.fn().mockResolvedValue({ error: null });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const del = vi.fn().mockReturnValue({ eq: eq1 });
      return { delete: del };
    });

    const res = await DELETE(makeReq('DELETE') as any, { params: Promise.resolve({ id: CAT_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
