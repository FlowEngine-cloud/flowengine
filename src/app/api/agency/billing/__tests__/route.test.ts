import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockStripeInstance } = vi.hoisted(() => {
  const mockStripeInstance = {
    customers: { retrieve: vi.fn() },
    invoices: {
      create: vi.fn(),
      finalizeInvoice: vi.fn(),
      sendInvoice: vi.fn(),
    },
    invoiceItems: { create: vi.fn() },
    paymentIntents: { create: vi.fn() },
    charges: { retrieve: vi.fn() },
    prices: { create: vi.fn() },
    subscriptions: { create: vi.fn() },
  };
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin, mockStripeInstance };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));
vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetIn: 60000 }),
}));
vi.mock('@/lib/encryption', () => ({
  decryptApiKey: vi.fn().mockReturnValue('sk_test_valid'),
}));
vi.mock('stripe', () => ({
  default: class {
    constructor() { return mockStripeInstance; }
  },
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CUSTOMER_ID = 'cus_test123';
const VALID_AMOUNT = 1000;

function makePost(body?: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/agency/billing', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
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
    data: { agency_stripe_key_encrypted: 'encrypted_key' },
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

// ─── Auth & Validation ────────────────────────────────────────────────────────

describe('POST /api/agency/billing – auth & validation', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/agency/billing', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth(null);
    expect((await POST(makePost({}) as any)).status).toBe(401);
  });

  it('returns 429 when rate-limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 30000 });
    expect((await POST(makePost({ action: 'invoice', customerId: CUSTOMER_ID, amount: VALID_AMOUNT }) as any)).status).toBe(429);
  });

  it('returns 400 when request body is not valid JSON', async () => {
    const req = new NextRequest('http://localhost/api/agency/billing', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-token', 'Content-Type': 'application/json' },
      body: 'not-json{{{',
    });
    expect((await POST(req as any)).status).toBe(400);
  });

  it('returns 400 when action is missing', async () => {
    const res = await POST(makePost({ customerId: CUSTOMER_ID, amount: VALID_AMOUNT }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when customerId is missing', async () => {
    const res = await POST(makePost({ action: 'invoice', amount: VALID_AMOUNT }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is missing', async () => {
    const res = await POST(makePost({ action: 'invoice', customerId: CUSTOMER_ID }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid action value', async () => {
    const res = await POST(makePost({ action: 'refund', customerId: CUSTOMER_ID, amount: VALID_AMOUNT }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount is below minimum (< 50)', async () => {
    const res = await POST(makePost({ action: 'invoice', customerId: CUSTOMER_ID, amount: 25 }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when amount exceeds maximum', async () => {
    const res = await POST(makePost({ action: 'invoice', customerId: CUSTOMER_ID, amount: 100000000 }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when customerId does not start with cus_', async () => {
    const res = await POST(makePost({ action: 'invoice', customerId: 'sub_wrongformat', amount: VALID_AMOUNT }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for subscription action with invalid interval', async () => {
    const res = await POST(makePost({
      action: 'subscription',
      customerId: CUSTOMER_ID,
      amount: VALID_AMOUNT,
      interval: 'hourly',
    }) as any);
    expect(res.status).toBe(400);
  });
});

// ─── Stripe not connected ─────────────────────────────────────────────────────

describe('POST /api/agency/billing – Stripe not connected', () => {
  it('returns 400 when agency has no Stripe key', async () => {
    mockProfileNoKey();
    const res = await POST(makePost({
      action: 'invoice',
      customerId: CUSTOMER_ID,
      amount: VALID_AMOUNT,
    }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Stripe not connected');
  });
});

// ─── Invoice action ───────────────────────────────────────────────────────────

describe('POST /api/agency/billing – invoice action', () => {
  beforeEach(() => {
    mockProfileWithKey();
    // Customer exists and is not deleted
    mockStripeInstance.customers.retrieve.mockResolvedValue({ id: CUSTOMER_ID, deleted: false });
  });

  it('returns 200 with invoice details on success', async () => {
    mockStripeInstance.invoices.create.mockResolvedValue({ id: 'inv_123' });
    mockStripeInstance.invoiceItems.create.mockResolvedValue({});
    mockStripeInstance.invoices.finalizeInvoice.mockResolvedValue({
      id: 'inv_123',
      hosted_invoice_url: 'https://invoice.url',
      status: 'open',
    });
    mockStripeInstance.invoices.sendInvoice.mockResolvedValue({});

    const res = await POST(makePost({
      action: 'invoice',
      customerId: CUSTOMER_ID,
      amount: VALID_AMOUNT,
      description: 'Test service',
    }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.type).toBe('invoice');
    expect(body.invoiceId).toBe('inv_123');
    expect(body.invoiceUrl).toBe('https://invoice.url');
  });

  it('returns 400 when customer has been deleted', async () => {
    mockStripeInstance.customers.retrieve.mockResolvedValue({ id: CUSTOMER_ID, deleted: true });
    const res = await POST(makePost({
      action: 'invoice',
      customerId: CUSTOMER_ID,
      amount: VALID_AMOUNT,
    }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when customer does not exist in Stripe', async () => {
    mockStripeInstance.customers.retrieve.mockRejectedValue(new Error('No such customer'));
    const res = await POST(makePost({
      action: 'invoice',
      customerId: CUSTOMER_ID,
      amount: VALID_AMOUNT,
    }) as any);
    expect(res.status).toBe(400);
  });
});

// ─── Charge action ────────────────────────────────────────────────────────────

describe('POST /api/agency/billing – charge action', () => {
  beforeEach(() => {
    mockProfileWithKey();
  });

  it('returns 400 when customer has no default payment method', async () => {
    mockStripeInstance.customers.retrieve.mockResolvedValue({
      id: CUSTOMER_ID,
      deleted: false,
      invoice_settings: { default_payment_method: null },
      default_source: null,
    });
    const res = await POST(makePost({
      action: 'charge',
      customerId: CUSTOMER_ID,
      amount: VALID_AMOUNT,
    }) as any);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('no default payment method');
  });

  it('returns 200 with paymentIntent on success', async () => {
    mockStripeInstance.customers.retrieve.mockResolvedValue({
      id: CUSTOMER_ID,
      deleted: false,
      invoice_settings: { default_payment_method: 'pm_test123' },
    });
    mockStripeInstance.paymentIntents.create.mockResolvedValue({
      id: 'pi_test',
      status: 'succeeded',
      amount: VALID_AMOUNT,
      latest_charge: 'ch_test',
    });
    mockStripeInstance.charges.retrieve.mockResolvedValue({
      receipt_url: 'https://receipt.url',
    });

    const res = await POST(makePost({
      action: 'charge',
      customerId: CUSTOMER_ID,
      amount: VALID_AMOUNT,
    }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.type).toBe('charge');
    expect(body.paymentIntentId).toBe('pi_test');
  });
});

// ─── Subscription action ──────────────────────────────────────────────────────

describe('POST /api/agency/billing – subscription action', () => {
  beforeEach(() => {
    mockProfileWithKey();
    mockStripeInstance.customers.retrieve.mockResolvedValue({ id: CUSTOMER_ID, deleted: false });
    mockStripeInstance.prices.create.mockResolvedValue({ id: 'price_test' });
    mockStripeInstance.subscriptions.create.mockResolvedValue({
      id: 'sub_test',
      status: 'active',
    });
  });

  it('returns 200 with subscription details', async () => {
    const res = await POST(makePost({
      action: 'subscription',
      customerId: CUSTOMER_ID,
      amount: VALID_AMOUNT,
      interval: 'month',
    }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.type).toBe('subscription');
    expect(body.subscriptionId).toBe('sub_test');
  });
});
