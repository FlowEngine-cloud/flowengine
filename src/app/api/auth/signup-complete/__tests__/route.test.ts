import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockAuthClient, mockServiceClient, mockCreateServerClient } = vi.hoisted(() => {
  const mockAuthClient = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  };
  const mockServiceClient = {
    auth: { getUser: vi.fn() },
    from: vi.fn(),
  };
  const mockCreateServerClient = vi.fn();
  return { mockAuthClient, mockServiceClient, mockCreateServerClient };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: mockCreateServerClient,
}));
vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(undefined),
  }),
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePost() {
  return new NextRequest('http://localhost/api/auth/signup-complete', { method: 'POST' });
}

function mockAuth(user: { id: string; email: string } | null) {
  mockAuthClient.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Use a counter so each test starts fresh regardless of how many calls the previous test made
  let callCount = 0;
  mockCreateServerClient.mockImplementation(() => {
    callCount++;
    return callCount === 1 ? mockAuthClient : mockServiceClient;
  });
  mockAuth({ id: 'user-123', email: 'user@example.com' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/auth/signup-complete', () => {
  it('returns 401 when user is not authenticated', async () => {
    mockAuth(null);
    const res = await POST(makePost() as any);
    expect(res.status).toBe(401);
  });

  it('returns 200 when profile already exists', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockServiceClient.from.mockReturnValue({ select });

    const res = await POST(makePost() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 200 after creating new profile', async () => {
    let fromCall = 0;
    mockServiceClient.from.mockImplementation(() => {
      fromCall++;
      if (fromCall === 1) {
        const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      const insert = vi.fn().mockResolvedValue({ data: null, error: null });
      return { insert };
    });

    const res = await POST(makePost() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 500 when profile insert fails', async () => {
    let fromCall = 0;
    mockServiceClient.from.mockImplementation(() => {
      fromCall++;
      if (fromCall === 1) {
        const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      const insert = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } });
      return { insert };
    });

    const res = await POST(makePost() as any);
    expect(res.status).toBe(500);
  });
});
