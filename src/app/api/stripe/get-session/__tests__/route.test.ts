import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockStripe } = vi.hoisted(() => {
  const mockStripe = {
    checkout: {
      sessions: {
        retrieve: vi.fn().mockResolvedValue({
          id: 'cs_test_abc123',
          client_reference_id: 'user-123',
          metadata: {},
          subscription: null,
          customer: 'cus_test',
          payment_status: 'paid',
          status: 'complete',
          amount_total: 999,
          currency: 'usd',
        }),
      },
    },
  };
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() } };
  return { mockSupabaseAdmin, mockStripe };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => mockStripe),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGet(sessionId?: string, token = 'valid-token') {
  const url = `http://localhost/api/stripe/get-session${sessionId ? `?session_id=${sessionId}` : ''}`;
  return new NextRequest(url, {
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

describe('GET /api/stripe/get-session', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/stripe/get-session?session_id=cs_test');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet('cs_test_abc123') as any)).status).toBe(401);
  });

  it('returns 400 when session_id is missing', async () => {
    const res = await GET(makeGet() as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('session_id');
  });

  it('returns 403 when session belongs to different user', async () => {
    mockStripe.checkout.sessions.retrieve.mockResolvedValueOnce({
      id: 'cs_test_other',
      client_reference_id: 'other-user-999',
      metadata: {},
      subscription: null,
      customer: null,
      payment_status: 'paid',
      status: 'complete',
      amount_total: 999,
      currency: 'usd',
    });

    const res = await GET(makeGet('cs_test_other') as any);
    expect(res.status).toBe(403);
  });

  it('returns 200 with session details on success', async () => {
    const res = await GET(makeGet('cs_test_abc123') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe('cs_test_abc123');
    expect(body.amount_total).toBe(9.99);
    expect(body.currency).toBe('usd');
    expect(body.payment_status).toBe('paid');
  });
});
