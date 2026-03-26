import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  isValidWebhookUrl: vi.fn().mockReturnValue({ valid: true }),
  sanitizeString: vi.fn((s: string) => s?.trim() || ''),
  validateAndSanitizeCSS: vi.fn().mockReturnValue({ valid: true, sanitized: '' }),
}));

import { GET, POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(method: string, body?: any, token = 'valid-token') {
  return new NextRequest('http://localhost/api/widget-studio/templates', {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

// GET has 3 parallel Promise.all queries + 1 main query
// Promise.all: [pay_per_instance (select→eq), client_instances (select→eq), client_instances (select→eq)]
// Main query: client_widgets (select→not→order→{eq,or} — awaitable)
function mockGetSuccess() {
  let call = 0;
  mockSupabaseAdmin.from.mockImplementation(() => {
    call++;
    if (call <= 3) {
      // Calls 1-3: select → eq (awaitable directly)
      const eq = vi.fn().mockResolvedValue({ data: [], error: null });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    // Call 4: client_widgets — select → not → order → {eq, or} (awaitable)
    const queryResult = { data: [{ id: 'w-1', name: 'My Widget', widget_type: 'button' }], error: null };
    const orderResult = {
      eq: vi.fn().mockResolvedValue(queryResult),
      or: vi.fn().mockResolvedValue(queryResult),
    };
    const order = vi.fn().mockReturnValue(orderResult);
    const not = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ not });
    return { select };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/widget-studio/templates', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/widget-studio/templates');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeReq('GET') as any)).status).toBe(401);
  });

  it('returns 200 with templates on success', async () => {
    mockGetSuccess();
    const res = await GET(makeReq('GET') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.templates)).toBe(true);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/widget-studio/templates', () => {
  const VALID_BODY = { name: 'My Button', widget_type: 'button' };

  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/widget-studio/templates', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makeReq('POST', VALID_BODY) as any)).status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false });
    const res = await POST(makeReq('POST', VALID_BODY) as any);
    expect(res.status).toBe(429);
  });

  it('returns 400 when name is missing', async () => {
    const { sanitizeString } = await import('@/lib/validation');
    (sanitizeString as any).mockReturnValueOnce('');
    const res = await POST(makeReq('POST', { widget_type: 'button' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('name');
  });

  it('returns 400 for invalid widget_type', async () => {
    const res = await POST(makeReq('POST', { name: 'Test', widget_type: 'unknown' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 for form type without form_fields', async () => {
    const res = await POST(makeReq('POST', { name: 'Test', widget_type: 'form' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('field');
  });

  it('returns 201 on successful creation (no instance)', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'w-new', name: 'My Button', widget_type: 'button' },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    mockSupabaseAdmin.from.mockReturnValue({ insert });

    const res = await POST(makeReq('POST', VALID_BODY) as any);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.template.id).toBe('w-new');
  });
});
