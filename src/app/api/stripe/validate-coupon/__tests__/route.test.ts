import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockStripe } = vi.hoisted(() => {
  const mockStripe = {
    promotionCodes: {
      retrieve: vi.fn(),
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    coupons: {
      retrieve: vi.fn(),
    },
  };
  return { mockStripe };
});

vi.mock('@/lib/stripe', () => ({
  getStripe: vi.fn(() => mockStripe),
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makePost(body: Record<string, any>) {
  return new NextRequest('http://localhost/api/stripe/validate-coupon', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockStripe.promotionCodes.list.mockResolvedValue({ data: [] });
  mockStripe.promotionCodes.retrieve.mockRejectedValue(new Error('Not found'));
  mockStripe.coupons.retrieve.mockRejectedValue(new Error('Not found'));
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/stripe/validate-coupon', () => {
  it('returns 400 when coupon is missing', async () => {
    const res = await POST(makePost({}) as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.message).toContain('required');
  });

  it('returns 400 when coupon is empty string', async () => {
    const res = await POST(makePost({ coupon: '  ' }) as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
  });

  it('returns 400 when coupon not found in any source', async () => {
    const res = await POST(makePost({ coupon: 'INVALID_CODE' }) as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.valid).toBe(false);
    expect(body.message).toContain('invalid or inactive');
  });

  it('returns 200 when coupon found as direct coupon ID', async () => {
    mockStripe.coupons.retrieve.mockResolvedValueOnce({
      id: 'SAVE20',
      valid: true,
      percent_off: 20,
      amount_off: null,
    });

    const res = await POST(makePost({ coupon: 'SAVE20' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.source).toBe('coupon');
    expect(body.message).toBe('20% off');
    expect(body.discountType).toBe('percent');
  });

  it('returns 200 when coupon found by promotion code lookup', async () => {
    mockStripe.promotionCodes.list.mockResolvedValueOnce({
      data: [{
        active: true,
        coupon: { valid: true, percent_off: null, amount_off: 1000 },
      }],
    });

    const res = await POST(makePost({ coupon: 'PROMO10' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.source).toBe('code_lookup');
    expect(body.message).toBe('$10.00 off');
    expect(body.discountType).toBe('amount');
  });

  it('returns 200 when promo_ ID is valid', async () => {
    mockStripe.promotionCodes.retrieve.mockResolvedValueOnce({
      active: true,
      coupon: { valid: true, percent_off: 15, amount_off: null },
    });

    const res = await POST(makePost({ coupon: 'promo_test123' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.valid).toBe(true);
    expect(body.source).toBe('promotion_code');
  });
});
