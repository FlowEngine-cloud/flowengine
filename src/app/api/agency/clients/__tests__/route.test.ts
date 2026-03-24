import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));

// resolveEffectiveUserId just returns the same user ID by default
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(body?: Record<string, any>, token = 'valid-token') {
  return new Request('http://localhost/api/agency/clients', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

/** Build a success DB chain: team_members → client_invites insert */
function mockDbSuccess(insertedId = 'client-abc') {
  let call = 0;
  mockSupabaseAdmin.from.mockImplementation((table: string) => {
    if (table === 'team_members') {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const eq2 = vi.fn().mockReturnValue({ limit });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    }
    // client_invites insert
    const single = vi.fn().mockResolvedValue({ data: { id: insertedId }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    return { insert };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/agency/clients', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = new Request('http://localhost/api/agency/clients', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test' }),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth(null);
    const res = await POST(makeRequest({ name: 'Test' }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    mockDbSuccess();
    const res = await POST(makeRequest({}) as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/name/i);
  });

  it('returns 400 when name is empty whitespace', async () => {
    mockDbSuccess();
    const res = await POST(makeRequest({ name: '   ' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when existingInstanceIds contains invalid UUID', async () => {
    // team_members mock only
    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'team_members') {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null });
        const limit = vi.fn().mockReturnValue({ maybeSingle });
        const eq2 = vi.fn().mockReturnValue({ limit });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      return {};
    });

    const res = await POST(makeRequest({ name: 'Client', existingInstanceIds: ['not-a-uuid'] }) as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid instance/i);
  });

  it('returns 201/200 on successful client creation with just a name', async () => {
    mockDbSuccess('new-client-id');

    const res = await POST(makeRequest({ name: 'Acme Corp' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.clientId).toBe('new-client-id');
  });

  it('returns 500 when DB insert fails', async () => {
    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'team_members') {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null });
        const limit = vi.fn().mockReturnValue({ maybeSingle });
        const eq2 = vi.fn().mockReturnValue({ limit });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // client_invites insert error
      const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      return { insert };
    });

    const res = await POST(makeRequest({ name: 'Acme' }) as any);
    expect(res.status).toBe(500);
  });

  it('generates a placeholder email when no email is provided', async () => {
    let capturedInsert: Record<string, any> = {};
    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'team_members') {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null });
        const limit = vi.fn().mockReturnValue({ maybeSingle });
        const eq2 = vi.fn().mockReturnValue({ limit });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      const single = vi.fn().mockResolvedValue({ data: { id: 'id-1' }, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockImplementation((data) => { capturedInsert = data; return { select }; });
      return { insert };
    });

    await POST(makeRequest({ name: 'No Email Client' }) as any);
    expect(capturedInsert.email).toMatch(/^noemail-.+@portal\.local$/);
  });

  it('uses provided email when given', async () => {
    let capturedInsert: Record<string, any> = {};
    mockSupabaseAdmin.from.mockImplementation((table: string) => {
      if (table === 'team_members') {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null });
        const limit = vi.fn().mockReturnValue({ maybeSingle });
        const eq2 = vi.fn().mockReturnValue({ limit });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      const single = vi.fn().mockResolvedValue({ data: { id: 'id-2' }, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockImplementation((data) => { capturedInsert = data; return { select }; });
      return { insert };
    });

    await POST(makeRequest({ name: 'Named Client', email: 'Client@Example.COM' }) as any);
    expect(capturedInsert.email).toBe('client@example.com'); // lowercased
  });
});
