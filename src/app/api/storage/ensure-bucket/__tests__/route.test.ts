import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSchema = {
    from: vi.fn(),
  };
  const mockSupabaseAdmin = {
    auth: { getUser: vi.fn() },
    schema: vi.fn().mockReturnValue(mockSchema),
    _mockSchema: mockSchema,
  };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePost(token = 'valid-token') {
  return new NextRequest('http://localhost/api/storage/ensure-bucket', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
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
  // Reset schema mock
  mockSupabaseAdmin.schema.mockReturnValue(mockSupabaseAdmin._mockSchema);
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/storage/ensure-bucket', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/storage/ensure-bucket', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost() as any)).status).toBe(401);
  });

  it('returns 200 with created:false when bucket already exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'agency-branding' }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin._mockSchema.from.mockReturnValue({ select });

    const res = await POST(makePost() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.created).toBe(false);
  });

  it('returns 200 with created:true when bucket is newly created', async () => {
    let call = 0;
    mockSupabaseAdmin._mockSchema.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // Check existence — not found
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // Insert
      return { insert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const res = await POST(makePost() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.created).toBe(true);
  });

  it('returns 500 when insert fails', async () => {
    let call = 0;
    mockSupabaseAdmin._mockSchema.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      return { insert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }) };
    });

    const res = await POST(makePost() as any);
    expect(res.status).toBe(500);
  });
});
