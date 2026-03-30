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
vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}));
vi.mock('@/lib/n8nInstanceApi', () => ({
  fetchN8nExecutions: vi.fn().mockResolvedValue({ executions: [], error: null, metrics: { total: 0, success: 0, failed: 0, running: 0 } }),
  fetchN8nWorkflows: vi.fn().mockResolvedValue({ workflows: [], error: null }),
  extractCredentialsFromWorkflows: vi.fn().mockResolvedValue({ credentials: [] }),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGet(token = 'valid-token') {
  return new NextRequest('http://localhost/api/client/all-executions', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

// Main query: or → neq → is → not (awaitable at end)
function mockInstancesQuery(instances: any[]) {
  const not = vi.fn().mockResolvedValue({ data: instances, error: null });
  const is = vi.fn().mockReturnValue({ not });
  const neq = vi.fn().mockReturnValue({ is });
  const or = vi.fn().mockReturnValue({ neq });
  const select = vi.fn().mockReturnValue({ or });
  mockSupabaseAdmin.from.mockReturnValue({ select });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/client/all-executions', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/all-executions');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet() as any)).status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false });
    const res = await GET(makeGet() as any);
    expect(res.status).toBe(429);
  });

  it('returns empty data when no instances found', async () => {
    mockInstancesQuery([]);

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.executions).toEqual([]);
    expect(body.workflows).toEqual([]);
    expect(body.instances).toEqual([]);
    expect(body.metrics).toEqual({ total: 0, success: 0, failed: 0, running: 0 });
    expect(body.widgets).toEqual([]);
  });

  it('returns aggregated data when instances exist', async () => {
    const instance = {
      id: 'inst-1',
      instance_name: 'My Instance',
      instance_url: 'https://n8n.example.com',
      n8n_api_key: 'test-key',
      user_id: 'user-123',
    };

    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // pay_per_instance_deployments query
        const not = vi.fn().mockResolvedValue({ data: [instance], error: null });
        const is = vi.fn().mockReturnValue({ not });
        const neq = vi.fn().mockReturnValue({ is });
        const or = vi.fn().mockReturnValue({ neq });
        const select = vi.fn().mockReturnValue({ or });
        return { select };
      }
      if (call === 2) {
        // client_instances: select → in
        const inFn = vi.fn().mockResolvedValue({ data: [], error: null });
        const select = vi.fn().mockReturnValue({ in: inFn });
        return { select };
      }
      if (call === 3) {
        // client_widgets: select → in → not
        const not = vi.fn().mockResolvedValue({ data: [], error: null });
        const inFn = vi.fn().mockReturnValue({ not });
        const select = vi.fn().mockReturnValue({ in: inFn });
        return { select };
      }
      return { select: vi.fn().mockReturnValue({ in: vi.fn().mockResolvedValue({ data: [], error: null }) }) };
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.instances).toHaveLength(1);
    expect(body.instances[0].instanceName).toBe('My Instance');
  });
});
