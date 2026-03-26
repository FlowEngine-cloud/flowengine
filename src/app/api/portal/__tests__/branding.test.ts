import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock @supabase/supabase-js before importing the route ────────────────────

const { mockClient } = vi.hoisted(() => {
  const maybeSingle = vi.fn();
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const from = vi.fn().mockReturnValue({ select });
  const getUser = vi.fn();
  const mockClient = {
    auth: { getUser },
    from,
    // helpers to reach the inner mocks in tests
    _mocks: { getUser, from, select, eq, maybeSingle, limit },
  };
  return { mockClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}));

import { GET } from '../branding/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(token?: string): Request {
  return new Request('http://localhost/api/portal/branding', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function mockAuth(userId: string | null) {
  mockClient._mocks.getUser.mockResolvedValue({
    data: { user: userId ? { id: userId } : null },
    error: userId ? null : { message: 'Unauthorized' },
  });
}

function mockClientInstances(rows: Array<{ invited_by: string }>) {
  // from('client_instances').select(...).eq(...).limit(1)
  const maybeSingle = vi.fn().mockResolvedValue({ data: rows[0] ?? null });
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const eq = vi.fn().mockReturnValue({ limit });
  const select = vi.fn().mockReturnValue({ eq });

  mockClient.from.mockImplementation((table: string) => {
    if (table === 'client_instances') return { select };
    // profiles query
    return mockProfilesChain(null);
  });
}

function mockProfilesChain(profile: { agency_logo_url: string | null; business_name: string | null } | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data: profile });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

function mockFullFlow(
  userId: string,
  agencyId: string | null,
  agencyProfile: { agency_logo_url: string | null; business_name: string | null } | null
) {
  mockAuth(userId);
  mockClient.from.mockImplementation((table: string) => {
    if (table === 'client_instances') {
      // Route does: .select().eq().limit(1) and awaits the array result directly
      const rows = agencyId ? [{ invited_by: agencyId }] : [];
      const limit = vi.fn().mockResolvedValue({ data: rows });
      const eq = vi.fn().mockReturnValue({ limit });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    if (table === 'profiles') {
      // Route does: .select().eq().maybeSingle()
      const maybeSingle = vi.fn().mockResolvedValue({ data: agencyProfile });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    return { select: vi.fn() };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/portal/branding', () => {
  it('returns 401 when no Authorization header', async () => {
    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockClient._mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid token' },
    });
    const res = await GET(makeRequest('bad-token') as any);
    expect(res.status).toBe(401);
  });

  it('returns null branding for company users (no client_instances rows)', async () => {
    mockFullFlow('user-company', null, null);
    const res = await GET(makeRequest('valid-token') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ agency_logo_url: null, business_name: null });
  });

  it('returns agency branding for client users', async () => {
    mockFullFlow('user-client', 'agency-uuid', {
      agency_logo_url: 'https://cdn.example.com/logo.png',
      business_name: 'Acme Agency',
    });
    const res = await GET(makeRequest('valid-token') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.agency_logo_url).toBe('https://cdn.example.com/logo.png');
    expect(body.business_name).toBe('Acme Agency');
  });

  it('returns nulls when agency has no logo/name set', async () => {
    mockFullFlow('user-client', 'agency-uuid', {
      agency_logo_url: null,
      business_name: null,
    });
    const res = await GET(makeRequest('valid-token') as any);
    const body = await res.json();
    expect(body).toEqual({ agency_logo_url: null, business_name: null });
  });

  it('returns nulls when agency profile row does not exist', async () => {
    mockFullFlow('user-client', 'agency-uuid', null);
    const res = await GET(makeRequest('valid-token') as any);
    const body = await res.json();
    expect(body).toEqual({ agency_logo_url: null, business_name: null });
  });
});
