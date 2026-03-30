import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock @supabase/supabase-js before importing the route ────────────────────

const { mockClient } = vi.hoisted(() => {
  const getUser = vi.fn();
  const from = vi.fn();
  const mockClient = { auth: { getUser }, from };
  return { mockClient };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}));

import { GET } from '../client-check/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(token?: string): Request {
  return new Request('http://localhost/api/portal/client-check', {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
}

function mockAuth(user: { id: string } | null) {
  mockClient.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

function mockClientInstances(rows: Array<{ instance_id: string; invited_by: string; access_level: string }>) {
  const mockQuery = {
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
  };
  // .from(...).select(...).eq(...) resolves to { data: rows }
  (mockQuery as any).then = undefined; // not a promise itself
  const dbPromise = Promise.resolve({ data: rows });
  mockClient.from.mockReturnValue({
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue(dbPromise),
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/portal/client-check', () => {
  it('returns isClient:false when no Authorization header', async () => {
    const res = await GET(makeRequest() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.isClient).toBe(false);
    expect(body.instances).toEqual([]);
  });

  it('returns isClient:false when auth token is invalid', async () => {
    mockAuth(null);
    const res = await GET(makeRequest('bad-token') as any);
    const body = await res.json();
    expect(body.isClient).toBe(false);
  });

  it('returns isClient:false when user has no client_instances', async () => {
    mockAuth({ id: 'user-123' });
    mockClientInstances([]);
    const res = await GET(makeRequest('valid-token') as any);
    const body = await res.json();
    expect(body.isClient).toBe(false);
    expect(body.allowFullAccess).toBe(false);
    expect(body.instances).toEqual([]);
  });

  it('returns isClient:true with allowFullAccess:false for "view" access', async () => {
    mockAuth({ id: 'user-123' });
    mockClientInstances([
      { instance_id: 'inst-1', invited_by: 'agency-id', access_level: 'view' },
    ]);
    const res = await GET(makeRequest('valid-token') as any);
    const body = await res.json();
    expect(body.isClient).toBe(true);
    expect(body.allowFullAccess).toBe(false);
    expect(body.instances).toHaveLength(1);
  });

  it('returns allowFullAccess:true when any instance has "edit" access', async () => {
    mockAuth({ id: 'user-123' });
    mockClientInstances([
      { instance_id: 'inst-1', invited_by: 'agency-id', access_level: 'view' },
      { instance_id: 'inst-2', invited_by: 'agency-id', access_level: 'edit' },
    ]);
    const res = await GET(makeRequest('valid-token') as any);
    const body = await res.json();
    expect(body.isClient).toBe(true);
    expect(body.allowFullAccess).toBe(true);
  });

  it('returns allowFullAccess:true when any instance has "admin" access', async () => {
    mockAuth({ id: 'user-123' });
    mockClientInstances([
      { instance_id: 'inst-1', invited_by: 'agency-id', access_level: 'admin' },
    ]);
    const res = await GET(makeRequest('valid-token') as any);
    const body = await res.json();
    expect(body.allowFullAccess).toBe(true);
  });

  it('returns all instance records in the response', async () => {
    mockAuth({ id: 'user-456' });
    const instances = [
      { instance_id: 'inst-a', invited_by: 'agency-1', access_level: 'view' },
      { instance_id: 'inst-b', invited_by: 'agency-1', access_level: 'edit' },
    ];
    mockClientInstances(instances);
    const res = await GET(makeRequest('valid-token') as any);
    const body = await res.json();
    expect(body.instances).toHaveLength(2);
    expect(body.instances[0].instance_id).toBe('inst-a');
    expect(body.instances[1].access_level).toBe('edit');
  });
});
