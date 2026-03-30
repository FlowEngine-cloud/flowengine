import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockStripeInstance } = vi.hoisted(() => {
  const mockStripeInstance = {
    subscriptions: {
      retrieve: vi.fn(),
      list: vi.fn(),
    },
  };
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin, mockStripeInstance };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/encryption', () => ({
  decryptApiKey: vi.fn().mockReturnValue('sk_test_valid'),
}));
vi.mock('stripe', () => ({
  default: class {
    constructor() { return mockStripeInstance; }
  },
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGet(searchParams = '', token = 'valid-token') {
  return new NextRequest(`http://localhost/api/agency/subscriptions${searchParams}`, {
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

describe('GET /api/agency/subscriptions – auth', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/agency/subscriptions');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet() as any)).status).toBe(401);
  });
});

// ─── Stripe not connected ─────────────────────────────────────────────────────

describe('GET /api/agency/subscriptions – Stripe not connected', () => {
  it('returns 400 with connected: false when no Stripe key', async () => {
    mockProfileNoKey();
    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.connected).toBe(false);
  });
});

// ─── List subscriptions ───────────────────────────────────────────────────────

describe('GET /api/agency/subscriptions – list all', () => {
  it('returns 200 with formatted subscriptions', async () => {
    mockProfileWithKey();
    mockStripeInstance.subscriptions.list.mockResolvedValue({
      data: [
        {
          id: 'sub_abc',
          status: 'active',
          customer: { email: 'client@example.com', name: 'Client Co' },
          items: {
            data: [{
              price: {
                unit_amount: 4999,
                currency: 'usd',
                recurring: { interval: 'month' },
                product: { name: 'Pro Plan' },
              },
            }],
          },
          current_period_end: 1700000000,
        },
      ],
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.subscriptions).toHaveLength(1);
    expect(body.subscriptions[0].id).toBe('sub_abc');
    expect(body.subscriptions[0].amount).toBe(49.99);
    expect(body.subscriptions[0].productName).toBe('Pro Plan');
  });

  it('returns 200 with empty array when no subscriptions', async () => {
    mockProfileWithKey();
    mockStripeInstance.subscriptions.list.mockResolvedValue({ data: [] });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.subscriptions).toEqual([]);
  });

  it('returns 500 when Stripe list throws', async () => {
    mockProfileWithKey();
    mockStripeInstance.subscriptions.list.mockRejectedValue(new Error('Stripe error'));

    const res = await GET(makeGet() as any);
    expect(res.status).toBe(500);
  });
});

// ─── Get specific subscription ────────────────────────────────────────────────

describe('GET /api/agency/subscriptions?id=sub_xxx', () => {
  it('returns 200 with subscription details', async () => {
    mockProfileWithKey();
    mockStripeInstance.subscriptions.retrieve.mockResolvedValue({
      id: 'sub_specific',
      status: 'active',
      cancel_at_period_end: false,
      current_period_end: 1700000000,
      current_period_start: 1699000000,
      items: {
        data: [{
          price: {
            unit_amount: 2999,
            currency: 'usd',
            recurring: { interval: 'month' },
            product: { name: 'Basic Plan' },
          },
        }],
      },
    });

    const res = await GET(makeGet('?id=sub_specific') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.subscription.id).toBe('sub_specific');
    expect(body.subscription.amount).toBe(29.99);
    expect(body.subscription.productName).toBe('Basic Plan');
  });

  it('returns 404 when subscription does not exist in Stripe', async () => {
    mockProfileWithKey();
    mockStripeInstance.subscriptions.retrieve.mockRejectedValue(new Error('No such subscription'));

    const res = await GET(makeGet('?id=sub_notexist') as any);
    expect(res.status).toBe(404);
  });
});

// ─── agency_id param (client viewing their subscription) ─────────────────────

describe('GET /api/agency/subscriptions?agency_id=xxx', () => {
  it('returns 403 when client does not belong to the agency', async () => {
    // client_instances check returns null
    const single = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn().mockReturnValue({ single });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeGet('?agency_id=agency-xyz') as any);
    expect(res.status).toBe(403);
  });
});
