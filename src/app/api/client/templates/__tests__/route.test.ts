import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));
vi.mock('@/lib/n8nInstanceApi', () => ({
  fetchN8nCredentials: vi.fn().mockResolvedValue({ credentials: [], error: null }),
  extractCredentialsFromWorkflows: vi.fn().mockResolvedValue({ credentials: [] }),
}));
vi.mock('@/lib/n8n/credentialExtractor', () => ({
  checkCredentialStatus: vi.fn().mockImplementation((required: any[]) =>
    required.map((c: any) => ({ ...c, status: 'available' }))
  ),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeGet(instanceId?: string, token = 'valid-token') {
  const url = `http://localhost/api/client/templates${instanceId ? `?instanceId=${instanceId}` : ''}`;
  return new NextRequest(url, { headers: { authorization: `Bearer ${token}` } });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

const INSTANCE_ROW = {
  id: INSTANCE_ID,
  instance_url: 'https://n8n.example.com',
  n8n_api_key: 'test-key',
  user_id: 'user-123',
  invited_by_user_id: null,
  subscription_status: 'active',
};

function mockInstanceLookup(instance: any | null, clientAccess: any | null) {
  let call = 0;
  mockSupabaseAdmin.from.mockImplementation(() => {
    call++;
    if (call === 1) {
      // pay_per_instance: select → eq → maybeSingle
      const maybeSingle = vi.fn().mockResolvedValue({ data: instance, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    if (call === 2) {
      // client_instances: select → eq → eq → maybeSingle
      const maybeSingle = vi.fn().mockResolvedValue({ data: clientAccess, error: null });
      const eq2 = vi.fn().mockReturnValue({ maybeSingle });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    }
    if (call === 3) {
      // workflow_templates: select → eq → eq → order
      const order = vi.fn().mockResolvedValue({ data: [], error: null });
      const eq2 = vi.fn().mockReturnValue({ order });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    }
    // profiles: select → eq → single
    const single = vi.fn().mockResolvedValue({ data: { email: 'agency@example.com', full_name: 'Agency Name' }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    return { select };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/client/templates', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/client/templates?instanceId=${INSTANCE_ID}`);
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet(INSTANCE_ID) as any)).status).toBe(401);
  });

  it('returns 400 when instanceId is missing', async () => {
    const res = await GET(makeGet() as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('instanceId');
  });

  it('returns 404 when instance not found', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      if (call === 1) {
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // n8n_instances fallback
      const neq = vi.fn().mockReturnValue({ maybeSingle });
      const eq2 = vi.fn().mockReturnValue({ neq });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await GET(makeGet(INSTANCE_ID) as any);
    expect(res.status).toBe(404);
  });

  it('returns 403 when user is not owner or client', async () => {
    const foreignInstance = { ...INSTANCE_ROW, user_id: 'other-user' };
    mockInstanceLookup(foreignInstance, null /* not a client either */);
    const res = await GET(makeGet(INSTANCE_ID) as any);
    expect(res.status).toBe(403);
  });

  it('returns empty templates array when no templates exist', async () => {
    mockInstanceLookup(INSTANCE_ROW, null);

    const res = await GET(makeGet(INSTANCE_ID) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.templates).toEqual([]);
  });

  it('returns templates with credential status for owner', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // pay_per_instance
        const maybeSingle = vi.fn().mockResolvedValue({ data: INSTANCE_ROW, error: null });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 2) {
        // client_instances (null = owner, not client)
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      if (call === 3) {
        // workflow_templates with data
        const order = vi.fn().mockResolvedValue({
          data: [{
            id: 'tmpl-1', name: 'My Template', description: null, category: null, icon: null,
            required_credentials: [], is_active: true, import_count: 5, created_at: '2024-01-01',
            updated_at: '2024-01-01', version: 1, changelog: null,
          }],
          error: null,
        });
        const eq2 = vi.fn().mockReturnValue({ order });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      if (call === 4) {
        // profiles
        const single = vi.fn().mockResolvedValue({ data: { email: 'a@b.com', full_name: 'Agency' }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // credential_records
      const data: any[] = [];
      const select_impl = vi.fn().mockResolvedValue({ data, error: null });
      const eq = vi.fn().mockReturnValue({ select: select_impl });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await GET(makeGet(INSTANCE_ID) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0].agency_name).toBe('Agency');
  });
});
