import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockStripeInstance } = vi.hoisted(() => {
  const mockStripeInstance = {
    customers: { list: vi.fn() },
  };
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin, mockStripeInstance };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));
vi.mock('@/lib/encryption', () => ({
  decryptApiKey: vi.fn().mockReturnValue('sk_test_valid'),
}));
vi.mock('stripe', () => ({
  // Class constructor returns mockStripeInstance so `new Stripe(key)` works
  default: class {
    constructor() { return mockStripeInstance; }
  },
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGet(searchParams = '', token = 'valid-token') {
  return new NextRequest(`http://localhost/api/agency/customers${searchParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

function mockProfileWithKey() {
  const single = vi.fn().mockResolvedValue({
    data: { agency_stripe_key_encrypted: 'enc_key' },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  mockSupabaseAdmin.from.mockReturnValue({ select });
}

function mockProfileNoKey() {
  const single = vi.fn().mockResolvedValue({
    data: { agency_stripe_key_encrypted: null },
    error: null,
  });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  mockSupabaseAdmin.from.mockReturnValue({ select });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

describe('GET /api/agency/customers – auth', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/agency/customers');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet() as any)).status).toBe(401);
  });
});

// ─── Stripe not connected ─────────────────────────────────────────────────────

describe('GET /api/agency/customers – Stripe not connected', () => {
  it('returns 400 with connected: false', async () => {
    mockProfileNoKey();
    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.connected).toBe(false);
  });
});

// ─── List customers ───────────────────────────────────────────────────────────

describe('GET /api/agency/customers – list', () => {
  it('returns 200 with formatted customers', async () => {
    mockProfileWithKey();
    mockStripeInstance.customers.list.mockResolvedValue({
      data: [
        { id: 'cus_a', email: 'alice@example.com', name: 'Alice', created: 1700000000 },
        { id: 'cus_b', email: 'bob@example.com', name: 'Bob', created: 1699000000 },
      ],
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.customers).toHaveLength(2);
    expect(body.customers[0].id).toBe('cus_a');
    expect(body.customers[0].email).toBe('alice@example.com');
  });

  it('returns 200 with empty array when no customers', async () => {
    mockProfileWithKey();
    mockStripeInstance.customers.list.mockResolvedValue({ data: [] });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.customers).toEqual([]);
  });

  it('passes search email param to Stripe when provided', async () => {
    mockProfileWithKey();
    mockStripeInstance.customers.list.mockResolvedValue({ data: [] });

    await GET(makeGet('?search=test@example.com') as any);
    expect(mockStripeInstance.customers.list).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'test@example.com' })
    );
  });

  it('does NOT pass email param when search is not provided', async () => {
    mockProfileWithKey();
    mockStripeInstance.customers.list.mockResolvedValue({ data: [] });

    await GET(makeGet() as any);
    const callArg = mockStripeInstance.customers.list.mock.calls[0][0];
    expect(callArg.email).toBeUndefined();
  });

  it('returns 500 when Stripe throws', async () => {
    mockProfileWithKey();
    mockStripeInstance.customers.list.mockRejectedValue(new Error('Stripe error'));

    const res = await GET(makeGet() as any);
    expect(res.status).toBe(500);
  });
});
