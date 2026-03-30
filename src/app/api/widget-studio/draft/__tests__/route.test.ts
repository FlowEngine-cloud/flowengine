import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/validation', () => ({
  isValidUUID: vi.fn().mockReturnValue(true),
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
  validateAndSanitizeCSS: vi.fn().mockReturnValue({ valid: true, sanitized: '' }),
}));

import { GET, POST, DELETE } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeReq(method: string, urlSuffix = '', body?: any, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/widget-studio/draft${urlSuffix}`, {
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

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/widget-studio/draft', () => {
  it('returns { draft: null } without Authorization header (no 401)', async () => {
    const req = new NextRequest('http://localhost/api/widget-studio/draft');
    const res = await GET(req as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.draft).toBeNull();
  });

  it('returns { draft: null } for invalid token', async () => {
    mockAuth(null);
    const res = await GET(makeReq('GET') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.draft).toBeNull();
  });

  it('returns draft when found (most recent)', async () => {
    const draftData = { id: 'draft-1', widget_type: 'chatbot' };
    const maybeSingle = vi.fn().mockResolvedValue({ data: draftData, error: null });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const order = vi.fn().mockReturnValue({ limit });
    const eq3 = vi.fn().mockReturnValue({ order });
    const like = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ like });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeReq('GET') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.draft?.id).toBe('draft-1');
  });

  it('returns specific draft when id query param provided', async () => {
    const draftData = { id: 'draft-uuid-1', widget_type: 'form' };
    const maybeSingle = vi.fn().mockResolvedValue({ data: draftData, error: null });
    const eq3 = vi.fn().mockReturnValue({ maybeSingle });
    const eq2 = vi.fn().mockReturnValue({ eq: eq3 });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeReq('GET', '?id=draft-uuid-1') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.draft?.id).toBe('draft-uuid-1');
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/widget-studio/draft', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/widget-studio/draft', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    const res = await POST(makeReq('POST', '', { widget_type: 'chatbot', chatbot_config: {} }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid widget_type', async () => {
    const res = await POST(makeReq('POST', '', { widget_type: 'unknown' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Invalid component type');
  });

  it('returns 400 when chatbot type has no config', async () => {
    const res = await POST(makeReq('POST', '', { widget_type: 'chatbot' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Chatbot config required');
  });

  it('returns 429 when rate limited on new draft creation', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false });

    const res = await POST(makeReq('POST', '', { widget_type: 'chatbot', chatbot_config: { model: 'gpt-4' } }) as any);
    expect(res.status).toBe(429);
  });

  it('returns 200 with new draft on success', async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: 'new-draft', widget_type: 'chatbot' },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    mockSupabaseAdmin.from.mockReturnValue({ insert });

    const res = await POST(makeReq('POST', '', { widget_type: 'chatbot', chatbot_config: { model: 'gpt-4' } }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.draftId).toBe('new-draft');
  });

  it('returns 200 when updating existing draft (with draftId)', async () => {
    const draftId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    // chain: update → eq('id') → eq('user_id') → like('name') → eq('is_active') → select() → single()
    const single = vi.fn().mockResolvedValue({
      data: { id: draftId, widget_type: 'chatbot' },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq3 = vi.fn().mockReturnValue({ select });
    const like = vi.fn().mockReturnValue({ eq: eq3 });
    const eq2 = vi.fn().mockReturnValue({ like });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const update = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ update });

    const res = await POST(makeReq('POST', '', { widget_type: 'chatbot', chatbot_config: { model: 'gpt-4' }, draftId }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.draftId).toBe(draftId);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/widget-studio/draft', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/widget-studio/draft', { method: 'DELETE' });
    expect((await DELETE(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    const res = await DELETE(makeReq('DELETE') as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when no id and not deleteAll', async () => {
    const res = await DELETE(makeReq('DELETE') as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Draft ID required');
  });

  it('returns 200 deleting specific draft', async () => {
    const draftId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
    // chain: delete → eq('id') → eq('user_id') → like('name') → eq('is_active') ← awaited
    const eq3 = vi.fn().mockResolvedValue({ error: null });
    const like = vi.fn().mockReturnValue({ eq: eq3 });
    const eq2 = vi.fn().mockReturnValue({ like });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const del = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ delete: del });

    const res = await DELETE(makeReq('DELETE', `?id=${draftId}`) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it('returns 200 deleting all drafts', async () => {
    // chain: delete → eq('user_id') → like('name') → eq('is_active') → select('id') ← awaited
    const select = vi.fn().mockResolvedValue({ data: [{ id: 'd1' }, { id: 'd2' }], error: null });
    const eq2 = vi.fn().mockReturnValue({ select });
    const like = vi.fn().mockReturnValue({ eq: eq2 });
    const eq1 = vi.fn().mockReturnValue({ like });
    const del = vi.fn().mockReturnValue({ eq: eq1 });
    mockSupabaseAdmin.from.mockReturnValue({ delete: del });

    const res = await DELETE(makeReq('DELETE', '?all=true') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.deleted).toBe(2);
  });
});
