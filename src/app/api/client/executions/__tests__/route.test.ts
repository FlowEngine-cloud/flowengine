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
  isValidUUID: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/n8nInstanceApi', () => ({
  fetchN8nExecutions: vi.fn().mockResolvedValue({ executions: [], error: null }),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeGet(suffix = '', token = 'valid-token') {
  return new NextRequest(`http://localhost/api/client/executions${suffix}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

function mockMaybySingle(data: any) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const is = vi.fn().mockReturnValue({ maybeSingle });
  const or = vi.fn().mockReturnValue({ is });
  const eq = vi.fn().mockReturnValue({ or });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/client/executions', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/executions');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet() as any)).status).toBe(401);
  });

  it('returns 403 in preview mode when instance not found', async () => {
    // Preview: first check pay_per_instance (null), then n8n_instances fallback (null)
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      if (call === 1) {
        // pay_per_instance: select → eq → or → is → maybeSingle
        const is = vi.fn().mockReturnValue({ maybeSingle });
        const or = vi.fn().mockReturnValue({ is });
        const eq = vi.fn().mockReturnValue({ or });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // n8n_instances fallback: select → eq → eq → neq → maybeSingle
      const neq = vi.fn().mockReturnValue({ maybeSingle });
      const eq2 = vi.fn().mockReturnValue({ neq });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await GET(makeGet(`?preview=${INSTANCE_ID}`) as any);
    expect(res.status).toBe(403);
  });

  it('returns empty executions when no instance IDs found', async () => {
    // Normal mode: client_instances (empty) + pay_per_instance (empty)
    const eq = vi.fn().mockResolvedValue({ data: [], error: null });
    const notNull = vi.fn().mockReturnValue({ is: vi.fn().mockReturnValue({ awaitable: null }) });

    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // client_instances: select → eq ← awaited directly (try/catch)
        const eqFn = vi.fn().mockResolvedValue({ data: [], error: null });
        const select = vi.fn().mockReturnValue({ eq: eqFn });
        return { select };
      }
      // pay_per_instance: select → eq → not → is ← awaited directly
      const is = vi.fn().mockResolvedValue({ data: [], error: null });
      const not = vi.fn().mockReturnValue({ is });
      const eqFn = vi.fn().mockReturnValue({ not });
      const select = vi.fn().mockReturnValue({ eq: eqFn });
      return { select };
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.executions).toEqual([]);
  });

  it('returns executions for preview mode with valid instance', async () => {
    const { fetchN8nExecutions } = await import('@/lib/n8nInstanceApi');
    (fetchN8nExecutions as any).mockResolvedValueOnce({
      executions: [{ id: 'ex-1', status: 'success' }],
      error: null,
    });

    mockSupabaseAdmin.from.mockReturnValue(
      mockMaybySingle({
        id: INSTANCE_ID,
        instance_url: 'https://n8n.example.com',
        n8n_api_key: 'test-key',
      })
    );

    const res = await GET(makeGet(`?preview=${INSTANCE_ID}`) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.executions).toHaveLength(1);
  });

  it('returns empty executions when instance has no URL', async () => {
    mockSupabaseAdmin.from.mockReturnValue(
      mockMaybySingle({
        id: INSTANCE_ID,
        instance_url: null,
        n8n_api_key: null,
      })
    );

    const res = await GET(makeGet(`?preview=${INSTANCE_ID}`) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.executions).toEqual([]);
  });
});
