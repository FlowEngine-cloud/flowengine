import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));
vi.mock('@/lib/validation', () => ({
  isValidUUID: vi.fn((id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)),
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 9, resetIn: 60000 }),
}));

import { GET, PUT, POST, DELETE } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

function makeGet(searchParams = '', token = 'valid-token') {
  return new NextRequest(`http://localhost/api/agency/billing/settings${searchParams}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function makePut(body?: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/agency/billing/settings', {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makePost(body?: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/agency/billing/settings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeDelete(searchParams = '', token = 'valid-token') {
  return new NextRequest(`http://localhost/api/agency/billing/settings${searchParams}`, {
    method: 'DELETE',
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
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/agency/billing/settings', () => {
  it('returns 401 without auth', async () => {
    const req = new NextRequest(`http://localhost/api/agency/billing/settings?clientUserId=${VALID_UUID}`);
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 400 when clientUserId is invalid UUID', async () => {
    const res = await GET(makeGet('?clientUserId=bad-id') as any);
    expect(res.status).toBe(400);
  });

  it('returns settings and payments when found', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // billing_settings
        const maybeSingle = vi.fn().mockResolvedValue({ data: { monthly_expected_amount: 500, currency: 'usd', notes: 'VIP' } });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // manual_payments
      const order = vi.fn().mockResolvedValue({ data: [{ id: 'pay-1', amount: 100 }] });
      const eq2 = vi.fn().mockReturnValue({ order });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await GET(makeGet(`?clientUserId=${VALID_UUID}`) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.settings.monthly_expected_amount).toBe(500);
    expect(body.manualPayments).toHaveLength(1);
  });

  it('returns defaults when settings not found', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: null });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      const order = vi.fn().mockResolvedValue({ data: null });
      const eq2 = vi.fn().mockReturnValue({ order });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await GET(makeGet(`?clientUserId=${VALID_UUID}`) as any);
    const body = await res.json();
    expect(body.settings.monthly_expected_amount).toBe(0);
    expect(body.manualPayments).toEqual([]);
  });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/agency/billing/settings', () => {
  it('returns 400 when clientUserId is invalid', async () => {
    const res = await PUT(makePut({ clientUserId: 'bad-id' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when monthlyExpectedAmount is negative', async () => {
    const res = await PUT(makePut({ clientUserId: VALID_UUID, monthlyExpectedAmount: -1 }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful upsert', async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseAdmin.from.mockReturnValue({ upsert });

    const res = await PUT(makePut({ clientUserId: VALID_UUID, monthlyExpectedAmount: 999, notes: 'test' }) as any);
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 30000 });
    const res = await PUT(makePut({ clientUserId: VALID_UUID }) as any);
    expect(res.status).toBe(429);
  });
});

// ─── POST (manual payment) ───────────────────────────────────────────────────

describe('POST /api/agency/billing/settings (manual payment)', () => {
  it('returns 400 when amount is missing', async () => {
    const res = await POST(makePost({ clientUserId: VALID_UUID, paymentMethod: 'cash', paymentDate: '2025-01-01' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when paymentMethod is invalid', async () => {
    const res = await POST(makePost({ clientUserId: VALID_UUID, amount: 1000, paymentMethod: 'bitcoin', paymentDate: '2025-01-01' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when paymentDate is missing', async () => {
    const res = await POST(makePost({ clientUserId: VALID_UUID, amount: 1000, paymentMethod: 'cash' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 with payment id on success', async () => {
    const single = vi.fn().mockResolvedValue({ data: { id: 'pay-new' }, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    mockSupabaseAdmin.from.mockReturnValue({ insert });

    const res = await POST(makePost({
      clientUserId: VALID_UUID,
      amount: 5000,
      paymentMethod: 'bank_transfer',
      paymentDate: '2025-01-15',
    }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.id).toBe('pay-new');
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/agency/billing/settings', () => {
  it('returns 400 when id is invalid UUID', async () => {
    const res = await DELETE(makeDelete('?id=bad-id') as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 on successful delete', async () => {
    const eq2 = vi.fn().mockResolvedValue({ error: null });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const del = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ delete: del });

    const res = await DELETE(makeDelete(`?id=${VALID_UUID}`) as any);
    expect(res.status).toBe(200);
  });
});
