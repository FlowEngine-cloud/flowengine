import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseAdmin),
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_BODY = {
  instanceName: 'My n8n',
  instanceUrl: 'https://n8n.example.com',
  apiKey: 'test-api-key',
  serviceType: 'n8n',
};

function makePost(body: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/hosting/connect', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

function mockMaybeSingle(data: any) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const is = vi.fn().mockReturnValue({ maybeSingle });
  const eq2 = vi.fn().mockReturnValue({ is });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/hosting/connect', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/hosting/connect', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost(VALID_BODY) as any)).status).toBe(401);
  });

  it('returns 400 when instanceName is missing', async () => {
    const res = await POST(makePost({ ...VALID_BODY, instanceName: '' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('name');
  });

  it('returns 400 when instanceUrl is missing', async () => {
    const res = await POST(makePost({ ...VALID_BODY, instanceUrl: '' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('URL');
  });

  it('returns 400 for invalid serviceType', async () => {
    const res = await POST(makePost({ ...VALID_BODY, serviceType: 'docker' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Service type');
  });

  it('returns 400 when n8n apiKey is missing', async () => {
    const res = await POST(makePost({ ...VALID_BODY, apiKey: '' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('API key');
  });

  it('returns 400 for invalid URL format', async () => {
    const res = await POST(makePost({ ...VALID_BODY, instanceUrl: 'not-a-url' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Invalid instance URL');
  });

  it('returns 409 when instance URL already exists', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockMaybySingle({ id: 'existing-inst' }));
    const res = await POST(makePost(VALID_BODY) as any);
    expect(res.status).toBe(409);
  });

  it('returns 200 on successful connect', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // Duplicate check: no existing
        return mockMaybySingle(null);
      }
      // Insert
      const single = vi.fn().mockResolvedValue({
        data: { id: 'new-inst', instance_name: 'My n8n', instance_url: 'https://n8n.example.com', status: 'active', service_type: 'n8n' },
        error: null,
      });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      return { insert };
    });

    const res = await POST(makePost(VALID_BODY) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.instance.id).toBe('new-inst');
  });
});

// Helper (same as mockMaybySingle but fixes typo in outer scope)
function mockMaybySingle(data: any) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const is = vi.fn().mockReturnValue({ maybeSingle });
  const eq2 = vi.fn().mockReturnValue({ is });
  const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
  const select = vi.fn().mockReturnValue({ eq: eq1 });
  return { select };
}
