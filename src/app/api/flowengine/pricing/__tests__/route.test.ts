import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockFlowEngineClient } = vi.hoisted(() => {
  const mockFlowEngineClient = {
    testConnection: vi.fn().mockResolvedValue({ ok: true }),
    getPricing: vi.fn().mockResolvedValue({ instances: {}, whatsapp: {} }),
    createInstance: vi.fn(),
  };
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() } };
  return { mockSupabaseAdmin, mockFlowEngineClient };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/portalSettings', () => ({
  getPortalSettings: vi.fn().mockResolvedValue({ flowengine_api_key: 'fe_test_key' }),
  invalidateSettingsCache: vi.fn(),
}));
vi.mock('@/lib/flowengine', () => ({
  createFlowEngineClient: vi.fn().mockReturnValue(mockFlowEngineClient),
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
  return new NextRequest('http://localhost/api/flowengine/pricing', {
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

describe('GET /api/flowengine/pricing', () => {
  it('returns 401 without authorization', async () => {
    const req = new NextRequest('http://localhost/api/flowengine/pricing');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeReq('GET') as any)).status).toBe(401);
  });

  it('returns connected:false when no API key configured', async () => {
    const { getPortalSettings } = await import('@/lib/portalSettings');
    (getPortalSettings as any).mockResolvedValueOnce({ flowengine_api_key: null });

    const res = await GET(makeReq('GET') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.connected).toBe(false);
  });

  it('returns connected:false when connection test fails', async () => {
    mockFlowEngineClient.testConnection.mockResolvedValueOnce({ ok: false, error: 'Invalid key' });

    const res = await GET(makeReq('GET') as any);
    const body = await res.json();
    expect(body.connected).toBe(false);
    expect(body.error).toContain('Invalid key');
  });

  it('returns connected:true with pricing on success', async () => {
    const pricing = { instances: { '10gb': { price: 9, display: '$9/mo' } }, whatsapp: {} };
    mockFlowEngineClient.getPricing.mockResolvedValueOnce(pricing);

    const res = await GET(makeReq('GET') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.connected).toBe(true);
    expect(body.pricing).toEqual(pricing);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/flowengine/pricing', () => {
  it('returns 401 without authorization', async () => {
    const req = new NextRequest('http://localhost/api/flowengine/pricing', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns connected:false when no key provided and none saved', async () => {
    const { getPortalSettings } = await import('@/lib/portalSettings');
    (getPortalSettings as any).mockResolvedValueOnce({ flowengine_api_key: null });

    const res = await POST(makeReq('POST', {}) as any);
    const body = await res.json();
    expect(body.connected).toBe(false);
  });

  it('uses provided apiKey without fetching settings', async () => {
    const { createFlowEngineClient } = await import('@/lib/flowengine');
    const res = await POST(makeReq('POST', { apiKey: 'fe_custom_key' }) as any);
    const body = await res.json();
    expect(body.connected).toBe(true);
    expect(createFlowEngineClient).toHaveBeenCalledWith('fe_custom_key');
  });

  it('returns connected:true on successful test', async () => {
    const res = await POST(makeReq('POST', { apiKey: 'fe_key' }) as any);
    expect((await res.json()).connected).toBe(true);
  });
});
