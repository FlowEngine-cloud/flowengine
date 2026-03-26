import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockFEClient } = vi.hoisted(() => {
  const mockFEClient = {
    getInstance: vi.fn().mockResolvedValue({ id: 'inst-1', status: 'running' }),
    deleteInstance: vi.fn().mockResolvedValue(undefined),
  };
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() } };
  return { mockSupabaseAdmin, mockFEClient };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/portalSettings', () => ({
  getPortalSettings: vi.fn().mockResolvedValue({ flowengine_api_key: 'fe_key' }),
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

import { GET, DELETE } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'fe-inst-abc123';

function makeReq(method: string, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/flowengine/instances/${INSTANCE_ID}`, {
    method,
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
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/flowengine/instances/[instanceId]', () => {
  it('returns 401 without authorization', async () => {
    const req = new NextRequest(`http://localhost/api/flowengine/instances/${INSTANCE_ID}`);
    expect((await GET(req as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) })).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeReq('GET') as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) })).status).toBe(401);
  });

  it('returns 400 when no API key configured', async () => {
    const { createFlowEngineClient } = await import('@/lib/flowengine');
    (createFlowEngineClient as any).mockReturnValueOnce(null);
    const res = await GET(makeReq('GET') as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) });
    expect(res.status).toBe(400);
  });

  it('returns 200 with instance data', async () => {
    const res = await GET(makeReq('GET') as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.instance.id).toBe('inst-1');
  });

  it('returns 500 on unexpected error', async () => {
    mockFEClient.getInstance.mockRejectedValueOnce(new Error('Unexpected'));
    const res = await GET(makeReq('GET') as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) });
    expect(res.status).toBe(500);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/flowengine/instances/[instanceId]', () => {
  it('returns 401 without authorization', async () => {
    const req = new NextRequest(`http://localhost/api/flowengine/instances/${INSTANCE_ID}`, { method: 'DELETE' });
    expect((await DELETE(req as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) })).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await DELETE(makeReq('DELETE') as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) })).status).toBe(401);
  });

  it('returns 400 when no API key configured', async () => {
    const { createFlowEngineClient } = await import('@/lib/flowengine');
    (createFlowEngineClient as any).mockReturnValueOnce(null);
    const res = await DELETE(makeReq('DELETE') as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) });
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful deletion', async () => {
    const res = await DELETE(makeReq('DELETE') as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
