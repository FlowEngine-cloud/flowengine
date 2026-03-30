import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

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

function makeGet(token = 'valid-token') {
  return new NextRequest('http://localhost/api/portal/branding', {
    headers: { Authorization: `Bearer ${token}` },
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/portal/branding', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/portal/branding');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet() as any)).status).toBe(401);
  });

  it('returns null branding for agency user (no client_instances)', async () => {
    // client_instances: empty
    const data: any[] = [];
    const limit = vi.fn().mockResolvedValue({ data, error: null });
    const eq = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.agency_logo_url).toBeNull();
    expect(body.business_name).toBeNull();
  });

  it('returns agency branding for client user', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // client_instances: select → eq → limit
        const limit = vi.fn().mockResolvedValue({ data: [{ invited_by: 'agency-456' }], error: null });
        const eq = vi.fn().mockReturnValue({ limit });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // profiles: select → eq → maybeSingle
      const maybeSingle = vi.fn().mockResolvedValue({
        data: { agency_logo_url: 'https://cdn.example.com/logo.png', business_name: 'Acme Agency' },
        error: null,
      });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.agency_logo_url).toBe('https://cdn.example.com/logo.png');
    expect(body.business_name).toBe('Acme Agency');
  });

  it('returns null branding when agency profile has no logo', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        const limit = vi.fn().mockResolvedValue({ data: [{ invited_by: 'agency-456' }], error: null });
        const eq = vi.fn().mockReturnValue({ limit });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(body.agency_logo_url).toBeNull();
    expect(body.business_name).toBeNull();
  });
});
