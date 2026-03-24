import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockFEClient } = vi.hoisted(() => {
  const mockFEClient = {
    createInstance: vi.fn().mockResolvedValue({ instance: { id: 'fe-inst-1', instance_url: 'https://n8n.example.com' } }),
    listInstances: vi.fn().mockResolvedValue([{ id: 'fe-inst-1' }]),
  };
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() } };
  return { mockSupabaseAdmin, mockFEClient };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/portalSettings', () => ({
  getPortalSettings: vi.fn().mockResolvedValue({ flowengine_api_key: 'fe_test_key' }),
}));
vi.mock('@/lib/flowengine', () => ({
  createFlowEngineClient: vi.fn().mockReturnValue(mockFEClient),
  FlowEngineApiError: class FlowEngineApiError extends Error {
    status: number; code: string;
    constructor(status: number, code: string, message: string) {
      super(message); this.status = status; this.code = code;
    }
  },
}));

import { GET, POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(method: string, body?: any, token = 'valid-token') {
  return new NextRequest('http://localhost/api/flowengine/instances', {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
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

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/flowengine/instances', () => {
  it('returns 401 without authorization', async () => {
    const req = new NextRequest('http://localhost/api/flowengine/instances');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeReq('GET') as any)).status).toBe(401);
  });

  it('returns 400 when no API key configured', async () => {
    const { getPortalSettings } = await import('@/lib/portalSettings');
    (getPortalSettings as any).mockResolvedValueOnce({ flowengine_api_key: null });
    const { createFlowEngineClient } = await import('@/lib/flowengine');
    (createFlowEngineClient as any).mockReturnValueOnce(null);

    const res = await GET(makeReq('GET') as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 with instances list', async () => {
    const res = await GET(makeReq('GET') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.instances)).toBe(true);
  });

  it('returns 502 on connection error', async () => {
    mockFEClient.listInstances.mockRejectedValueOnce(new Error('fetch failed'));
    const res = await GET(makeReq('GET') as any);
    expect(res.status).toBe(502);
  });

  it('returns 504 on timeout', async () => {
    mockFEClient.listInstances.mockRejectedValueOnce(new Error('AbortError: timeout'));
    const res = await GET(makeReq('GET') as any);
    expect(res.status).toBe(504);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/flowengine/instances', () => {
  const validBody = { instanceName: 'My n8n', storageSize: 10, billingCycle: 'monthly' };

  it('returns 401 without authorization', async () => {
    const req = new NextRequest('http://localhost/api/flowengine/instances', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makeReq('POST', validBody) as any)).status).toBe(401);
  });

  it('returns 400 when no API key configured', async () => {
    const { getPortalSettings } = await import('@/lib/portalSettings');
    (getPortalSettings as any).mockResolvedValueOnce({ flowengine_api_key: null });
    const { createFlowEngineClient } = await import('@/lib/flowengine');
    (createFlowEngineClient as any).mockReturnValueOnce(null);

    const res = await POST(makeReq('POST', validBody) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when instanceName is missing', async () => {
    const res = await POST(makeReq('POST', { storageSize: 10, billingCycle: 'monthly' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Instance name');
  });

  it('returns 400 for invalid storage size', async () => {
    const res = await POST(makeReq('POST', { instanceName: 'Test', storageSize: 20, billingCycle: 'monthly' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('storage size');
  });

  it('returns 400 for invalid billing cycle', async () => {
    const res = await POST(makeReq('POST', { instanceName: 'Test', storageSize: 10, billingCycle: 'weekly' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('billing cycle');
  });

  it('returns 201 on successful creation', async () => {
    const res = await POST(makeReq('POST', validBody) as any);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it('forwards FlowEngineApiError status', async () => {
    const { FlowEngineApiError } = await import('@/lib/flowengine');
    mockFEClient.createInstance.mockRejectedValueOnce(
      new (FlowEngineApiError as any)(402, 'payment_required', 'Payment required')
    );
    const res = await POST(makeReq('POST', validBody) as any);
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.error).toBe('payment_required');
  });
});
