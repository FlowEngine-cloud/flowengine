import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockFEClient } = vi.hoisted(() => {
  const mockFEClient = {
    listWhatsAppSessions: vi.fn().mockResolvedValue([{ name: 'session-1', status: 'connected' }]),
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

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGet(token = 'valid-token') {
  return new NextRequest('http://localhost/api/flowengine/whatsapp', {
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/flowengine/whatsapp', () => {
  it('returns 401 without authorization', async () => {
    const req = new NextRequest('http://localhost/api/flowengine/whatsapp');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet() as any)).status).toBe(401);
  });

  it('returns empty sessions when no API key configured', async () => {
    const { createFlowEngineClient } = await import('@/lib/flowengine');
    (createFlowEngineClient as any).mockReturnValueOnce(null);
    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sessions).toEqual([]);
  });

  it('returns sessions list on success', async () => {
    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].name).toBe('session-1');
  });

  it('returns empty sessions on error', async () => {
    mockFEClient.listWhatsAppSessions.mockRejectedValueOnce(new Error('API error'));
    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(body.sessions).toEqual([]);
  });
});
