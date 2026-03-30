import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/n8n/credentialExtractor', () => ({
  extractRequiredCredentials: vi.fn().mockReturnValue([]),
}));
vi.mock('@/lib/emailService', () => ({
  emailService: { sendTemplateUpdateNotification: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/config', () => ({ APP_URL: 'https://app.example.com' }));

import { GET, PUT, DELETE } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TEMPLATE_ID = 'tmpl-001';

function makeReq(method: string, token = 'valid-token', body?: any) {
  return new NextRequest(`http://localhost/api/n8n-templates/${TEMPLATE_ID}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

const TEMPLATE_DATA = {
  id: TEMPLATE_ID,
  name: 'Test Template',
  description: 'A test template',
  category: 'automation',
  icon: '🤖',
  workflow_json: { nodes: [{ name: 'Trigger' }], connections: {} },
  required_credentials: [],
  import_count: 3,
  is_active: true,
  version: 1,
  changelog: null,
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
};

const VALID_WORKFLOW = {
  nodes: [{ name: 'Trigger', type: 'n8n-nodes-base.manualTrigger' }],
  connections: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/n8n-templates/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/n8n-templates/${TEMPLATE_ID}`);
    const res = await GET(req as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    const res = await GET(makeReq('GET') as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 200 with template when found', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // profiles query: select → eq → single
        const single = vi.fn().mockResolvedValue({ data: { team_id: null }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // workflow_templates query: select → eq → eq → maybeSingle
      const maybeSingle = vi.fn().mockResolvedValue({ data: TEMPLATE_DATA, error: null });
      const eq2 = vi.fn().mockReturnValue({ maybeSingle });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await GET(makeReq('GET') as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.template.id).toBe(TEMPLATE_ID);
    expect(body.template.workflow_json).toBeDefined();
  });

  it('returns 404 when template not found (no client link)', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // profiles
        const single = vi.fn().mockResolvedValue({ data: { team_id: null }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 2) {
        // workflow_templates — not found
        const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // client_instances — no link
      const limit = vi.fn().mockResolvedValue({ data: [], error: null });
      const eq = vi.fn().mockReturnValue({ limit });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await GET(makeReq('GET') as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(404);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/n8n-templates/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/n8n-templates/${TEMPLATE_ID}`, { method: 'DELETE' });
    const res = await DELETE(req as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    const res = await DELETE(makeReq('DELETE') as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when template not found', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // profiles
        const single = vi.fn().mockResolvedValue({ data: { team_id: null }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // workflow_templates check: select → eq → eq → single
      const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      const eq2 = vi.fn().mockReturnValue({ single });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await DELETE(makeReq('DELETE') as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(404);
  });

  it('returns 200 on successful soft delete', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // profiles
        const single = vi.fn().mockResolvedValue({ data: { team_id: null }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 2) {
        // Check template exists: select → eq → eq → single
        const single = vi.fn().mockResolvedValue({ data: { id: TEMPLATE_ID, created_by: 'user-123' }, error: null });
        const eq2 = vi.fn().mockReturnValue({ single });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // update (soft delete): update → eq
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq });
      return { update };
    });

    const res = await DELETE(makeReq('DELETE') as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── PUT ──────────────────────────────────────────────────────────────────────

describe('PUT /api/n8n-templates/[id]', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/n8n-templates/${TEMPLATE_ID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    });
    const res = await PUT(req as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    const res = await PUT(makeReq('PUT', 'bad-token', { name: 'New Name' }) as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when template not found', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // profiles
        const single = vi.fn().mockResolvedValue({ data: { team_id: null }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // Check template — not found
      const single = vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      const eq2 = vi.fn().mockReturnValue({ single });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await PUT(makeReq('PUT', 'valid-token', { name: 'New Name' }) as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(404);
  });

  it('returns 400 for empty name', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        const single = vi.fn().mockResolvedValue({ data: { team_id: null }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      const single = vi.fn().mockResolvedValue({ data: { id: TEMPLATE_ID, created_by: 'user-123', version: 1 }, error: null });
      const eq2 = vi.fn().mockReturnValue({ single });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await PUT(makeReq('PUT', 'valid-token', { name: '   ' }) as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(400);
  });

  it('returns 400 when updating workflow_json without changelog', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        const single = vi.fn().mockResolvedValue({ data: { team_id: null }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      const single = vi.fn().mockResolvedValue({ data: { id: TEMPLATE_ID, created_by: 'user-123', version: 1, workflow_json: {} }, error: null });
      const eq2 = vi.fn().mockReturnValue({ single });
      const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
      const select = vi.fn().mockReturnValue({ eq: eq1 });
      return { select };
    });

    const res = await PUT(makeReq('PUT', 'valid-token', { workflow_json: VALID_WORKFLOW }) as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Changelog');
  });

  it('returns 200 on successful metadata update (name only)', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        const single = vi.fn().mockResolvedValue({ data: { team_id: null }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      if (call === 2) {
        // Check existing template
        const single = vi.fn().mockResolvedValue({ data: { id: TEMPLATE_ID, created_by: 'user-123', version: 1, workflow_json: {} }, error: null });
        const eq2 = vi.fn().mockReturnValue({ single });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // update: update → eq → select → single
      const single = vi.fn().mockResolvedValue({ data: { ...TEMPLATE_DATA, name: 'Updated Name' }, error: null });
      const select = vi.fn().mockReturnValue({ single });
      const eq = vi.fn().mockReturnValue({ select });
      const update = vi.fn().mockReturnValue({ eq });
      return { update };
    });

    const res = await PUT(makeReq('PUT', 'valid-token', { name: 'Updated Name' }) as any, { params: Promise.resolve({ id: TEMPLATE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.template.name).toBe('Updated Name');
  });
});
