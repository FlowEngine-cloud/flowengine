import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/apiKeyAuth', () => ({
  validateApiKey: vi.fn(),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(token = 'fp_valid') {
  return new Request('http://localhost/api/v1/instances', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET tests ────────────────────────────────────────────────────────────────

describe('GET /api/v1/instances', () => {
  it('returns 401 when API key is invalid', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValue(null);

    const res = await GET(makeRequest('bad') as any);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
  });

  it('returns instances list on success', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValue('user-123');

    const instances = [
      { id: 'inst-1', instance_name: 'my-n8n', instance_url: 'https://n8n.example.com', status: 'running' },
    ];
    const order = vi.fn().mockResolvedValue({ data: instances, error: null });
    const isNull = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ is: isNull });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].instance_name).toBe('my-n8n');
  });

  it('returns empty array when no instances', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValue('user-123');

    const order = vi.fn().mockResolvedValue({ data: null, error: null });
    const isNull = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ is: isNull });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('returns 500 when DB query fails', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValue('user-123');

    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const isNull = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ is: isNull });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest() as any);
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
  });
});
