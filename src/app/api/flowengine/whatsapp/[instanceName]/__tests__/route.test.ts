import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockFEClient } = vi.hoisted(() => {
  const mockFEClient = {
    getWhatsAppSession: vi.fn().mockResolvedValue({ name: 'session-1', status: 'connected', qr_code: null }),
    setWhatsAppWebhook: vi.fn().mockResolvedValue(undefined),
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
}));

import { GET, PUT } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_NAME = 'session-1';

function makeReq(method: string, body?: any, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/flowengine/whatsapp/${INSTANCE_NAME}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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

describe('GET /api/flowengine/whatsapp/[instanceName]', () => {
  it('returns 401 without authorization', async () => {
    const req = new NextRequest(`http://localhost/api/flowengine/whatsapp/${INSTANCE_NAME}`);
    expect((await GET(req as any, { params: Promise.resolve({ instanceName: INSTANCE_NAME }) })).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeReq('GET') as any, { params: Promise.resolve({ instanceName: INSTANCE_NAME }) })).status).toBe(401);
  });

  it('returns 400 when no API key configured', async () => {
    const { createFlowEngineClient } = await import('@/lib/flowengine');
    (createFlowEngineClient as any).mockReturnValueOnce(null);
    const res = await GET(makeReq('GET') as any, { params: Promise.resolve({ instanceName: INSTANCE_NAME }) });
    expect(res.status).toBe(400);
  });

  it('returns 200 with session data', async () => {
    const res = await GET(makeReq('GET') as any, { params: Promise.resolve({ instanceName: INSTANCE_NAME }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.session.name).toBe('session-1');
  });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/flowengine/whatsapp/[instanceName]', () => {
  it('returns 401 without authorization', async () => {
    const req = new NextRequest(`http://localhost/api/flowengine/whatsapp/${INSTANCE_NAME}`, { method: 'PUT' });
    expect((await PUT(req as any, { params: Promise.resolve({ instanceName: INSTANCE_NAME }) })).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await PUT(makeReq('PUT', { webhook_url: 'https://example.com' }) as any, { params: Promise.resolve({ instanceName: INSTANCE_NAME }) })).status).toBe(401);
  });

  it('returns 400 when no API key configured', async () => {
    const { createFlowEngineClient } = await import('@/lib/flowengine');
    (createFlowEngineClient as any).mockReturnValueOnce(null);
    const res = await PUT(makeReq('PUT', { webhook_url: '' }) as any, { params: Promise.resolve({ instanceName: INSTANCE_NAME }) });
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful webhook set', async () => {
    const res = await PUT(makeReq('PUT', { webhook_url: 'https://example.com/webhook' }) as any, { params: Promise.resolve({ instanceName: INSTANCE_NAME }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
