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
  return new Request('http://localhost/api/v1/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET tests ────────────────────────────────────────────────────────────────

describe('GET /api/v1/me', () => {
  it('returns 401 when API key is invalid', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValue(null);

    const res = await GET(makeRequest('bad-key') as any);
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  it('returns 404 when profile not found', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValue('user-123');

    const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116', message: 'Row not found' } });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest() as any);
    const body = await res.json();
    expect(res.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not found');
  });

  it('returns 200 with profile data on success', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValue('user-123');

    const profile = {
      id: 'user-123',
      full_name: 'Alice Example',
      email: 'alice@example.com',
      business_name: 'Example Corp',
      created_at: '2025-01-01T00:00:00Z',
    };
    const single = vi.fn().mockResolvedValue({ data: profile, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.email).toBe('alice@example.com');
    expect(body.data.business_name).toBe('Example Corp');
  });

  it('returns 404 when profile is null even without error', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValue('user-123');

    const single = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest() as any);
    expect(res.status).toBe(404);
  });
});
