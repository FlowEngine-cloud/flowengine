import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() } };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/portalSettings', () => ({
  getPortalSettings: vi.fn().mockResolvedValue({ ai_base_url: null, ai_api_key: 'test-key' }),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGet(token = 'valid-token') {
  return new NextRequest('http://localhost/api/client/models', {
    headers: { Authorization: `Bearer ${token}` },
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
  global.fetch = vi.fn();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/client/models', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/models');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet() as any)).status).toBe(401);
  });

  it('returns 403 when AI provider not configured', async () => {
    const { getPortalSettings } = await import('@/lib/portalSettings');
    (getPortalSettings as any).mockResolvedValueOnce({ ai_base_url: null, ai_api_key: null });

    const res = await GET(makeGet() as any);
    expect(res.status).toBe(403);
    expect((await res.json()).error).toContain('not configured');
  });

  it('returns 200 with model list on success', async () => {
    const modelsData = { data: [{ id: 'gpt-4' }, { id: 'gpt-3.5-turbo' }] };
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => modelsData,
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
  });

  it('forwards non-200 status from AI provider', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const res = await GET(makeGet() as any);
    expect(res.status).toBe(401);
  });

  it('uses default openrouter URL when ai_base_url is null', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await GET(makeGet() as any);
    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('openrouter.ai');
  });

  it('uses custom ai_base_url when provided', async () => {
    const { getPortalSettings } = await import('@/lib/portalSettings');
    (getPortalSettings as any).mockResolvedValueOnce({
      ai_base_url: 'https://custom.provider.com/api',
      ai_api_key: 'key',
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });

    await GET(makeGet() as any);
    const [url] = (global.fetch as any).mock.calls[0];
    expect(url).toContain('custom.provider.com');
  });
});
