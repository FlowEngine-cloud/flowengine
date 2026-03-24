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
  isValidWebhookUrl: vi.fn().mockReturnValue({ valid: true }),
  sanitizeString: vi.fn((s: string) => s?.trim() || ''),
  validateAndSanitizeCSS: vi.fn().mockReturnValue({ valid: true, sanitized: '' }),
}));

import { GET, PUT, DELETE } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WIDGET_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const USER_ID = 'user-123';

function makeReq(method: string, body?: any, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/widget-studio/templates/${WIDGET_ID}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

const params = { params: Promise.resolve({ id: WIDGET_ID }) };

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

// GET/DELETE: 3 parallel Promise.all + 1 main query
// Promise.all[0]: pay_per_instance → select → eq (awaitable)
// Promise.all[1]: client_instances (invited_by) → select → eq (awaitable)
// Promise.all[2]: client_instances (user_id) → select → eq (awaitable)
// Main: client_widgets → select → eq → maybeSingle/single (awaitable)
function mockParallelAndMain(mainData: any, mainMethod: 'maybeSingle' | 'single' = 'maybeSingle') {
  let call = 0;
  mockSupabaseAdmin.from.mockImplementation(() => {
    call++;
    if (call <= 3) {
      const eq = vi.fn().mockResolvedValue({ data: [], error: null });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    // Main client_widgets query
    const terminator = vi.fn().mockResolvedValue({ data: mainData, error: null });
    const eq = vi.fn().mockReturnValue({ [mainMethod]: terminator });
    const select = vi.fn().mockReturnValue({ eq });
    return { select };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: USER_ID });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/widget-studio/templates/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/widget-studio/templates/${WIDGET_ID}`);
    expect((await GET(req as any, params)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeReq('GET') as any, params)).status).toBe(401);
  });

  it('returns 400 for invalid UUID', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    (isValidUUID as any).mockReturnValueOnce(false);
    const res = await GET(makeReq('GET') as any, { params: Promise.resolve({ id: 'bad' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when widget not found', async () => {
    mockParallelAndMain(null);
    const res = await GET(makeReq('GET') as any, params);
    expect(res.status).toBe(404);
  });

  it('returns 403 when user has no access', async () => {
    // Widget belongs to different user, no instance overlap
    mockParallelAndMain({ id: WIDGET_ID, user_id: 'other-user', instance_id: null });
    const res = await GET(makeReq('GET') as any, params);
    expect(res.status).toBe(403);
  });

  it('returns 200 when user owns the widget directly', async () => {
    mockParallelAndMain({ id: WIDGET_ID, user_id: USER_ID, instance_id: null });
    const res = await GET(makeReq('GET') as any, params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.widget.id).toBe(WIDGET_ID);
  });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/widget-studio/templates/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/widget-studio/templates/${WIDGET_ID}`, { method: 'PUT' });
    expect((await PUT(req as any, params)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await PUT(makeReq('PUT') as any, params)).status).toBe(401);
  });

  it('returns 400 when no fields to update', async () => {
    const res = await PUT(makeReq('PUT', {}) as any, params);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('No fields');
  });

  it('returns 400 for invalid widget_type', async () => {
    const res = await PUT(makeReq('PUT', { widget_type: 'invalid' }) as any, params);
    expect(res.status).toBe(400);
  });

  it('returns 404 when widget not found after update', async () => {
    // 3 parallel Promise.all + existingWidget single (null)
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call <= 3) {
        const eq = vi.fn().mockResolvedValue({ data: [], error: null });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // existingWidget: select → eq → single
      const single = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await PUT(makeReq('PUT', { name: 'Updated' }) as any, params);
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful update', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call <= 3) {
        // Promise.all: select → eq (awaitable)
        const eq = vi.fn().mockResolvedValue({ data: [], error: null });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 4) {
        // existingWidget: select → eq → single
        const single = vi.fn().mockResolvedValue({
          data: { id: WIDGET_ID, instance_id: null, user_id: USER_ID },
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // update: update → eq → select → single
      const single = vi.fn().mockResolvedValue({
        data: { id: WIDGET_ID, name: 'Updated', widget_type: 'button' },
        error: null,
      });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      return { update };
    });

    const res = await PUT(makeReq('PUT', { name: 'Updated' }) as any, params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.template.id).toBe(WIDGET_ID);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/widget-studio/templates/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/widget-studio/templates/${WIDGET_ID}`, { method: 'DELETE' });
    expect((await DELETE(req as any, params)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await DELETE(makeReq('DELETE') as any, params)).status).toBe(401);
  });

  it('returns 404 when widget not found', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call <= 3) {
        const eq = vi.fn().mockResolvedValue({ data: [], error: null });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // existingWidget: select → eq → single (null)
      const single = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await DELETE(makeReq('DELETE') as any, params);
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful delete', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call <= 3) {
        const eq = vi.fn().mockResolvedValue({ data: [], error: null });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 4) {
        // existingWidget: select → eq → single
        const single = vi.fn().mockResolvedValue({
          data: { id: WIDGET_ID, instance_id: null, user_id: USER_ID },
          error: null,
        });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // delete: delete → eq
      const eq = vi.fn().mockResolvedValue({ error: null });
      const del = vi.fn().mockReturnValue({ eq });
      return { delete: del };
    });

    const res = await DELETE(makeReq('DELETE') as any, params);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
