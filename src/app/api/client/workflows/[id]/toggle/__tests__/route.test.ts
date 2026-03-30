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

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WORKFLOW_ID = 'abc123';
const INSTANCE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makePost(workflowId: string, body?: any, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/client/workflows/${workflowId}/toggle`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const params = (id = WORKFLOW_ID) => ({ params: Promise.resolve({ id }) });

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
  deleted_at: null,
  subscription_status: 'active',
};

function mockInstanceAccess(instance: any | null) {
  // 2 parallel calls: pay_per_instance + client_instances
  let call = 0;
  mockSupabaseAdmin.from.mockImplementation(() => {
    call++;
    if (call === 1) {
      // pay_per_instance: select → eq → eq → is → maybeSingle
      const maybeSingle = vi.fn().mockResolvedValue({ data: instance, error: null });
      const is = vi.fn().mockReturnValue({ maybeSingle });
      const eq2 = vi.fn().mockReturnValue({ is });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    }
    // client_instances: select → eq → eq → maybeSingle
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    return { select };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
  mockFetch.mockReset();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/client/workflows/[id]/toggle', () => {
  it('returns 400 for invalid workflow ID', async () => {
    const res = await POST(makePost('bad-id!!') as any, params('bad-id!!'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Invalid workflow ID');
  });

  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/client/workflows/${WORKFLOW_ID}/toggle`, { method: 'POST' });
    expect((await POST(req as any, params())).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost(WORKFLOW_ID, { active: true }) as any, params())).status).toBe(401);
  });

  it('returns 400 when active is not boolean', async () => {
    mockInstanceAccess(INSTANCE_ROW);
    const res = await POST(makePost(WORKFLOW_ID, { active: 'yes', instanceId: INSTANCE_ID }) as any, params());
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('boolean');
  });

  it('returns 404 when instance not found', async () => {
    mockInstanceAccess(null);
    const res = await POST(makePost(WORKFLOW_ID, { active: true, instanceId: INSTANCE_ID }) as any, params());
    expect(res.status).toBe(404);
  });

  it('returns 200 when workflow toggle succeeds', async () => {
    mockInstanceAccess(INSTANCE_ROW);

    // fetch calls: verify workflow + toggle
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: WORKFLOW_ID }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ active: true }) });

    const res = await POST(makePost(WORKFLOW_ID, { active: true, instanceId: INSTANCE_ID }) as any, params());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.active).toBe(true);
  });

  it('returns 404 when workflow not found in n8n', async () => {
    mockInstanceAccess(INSTANCE_ROW);
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'Not found' });

    const res = await POST(makePost(WORKFLOW_ID, { active: true, instanceId: INSTANCE_ID }) as any, params());
    expect(res.status).toBe(404);
  });
});
