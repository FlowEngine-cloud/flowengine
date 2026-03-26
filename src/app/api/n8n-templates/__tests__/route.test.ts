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
  emailService: { sendNewTemplateNotification: vi.fn().mockResolvedValue(undefined) },
}));
vi.mock('@/lib/config', () => ({
  APP_URL: 'https://app.example.com',
}));

import { GET, POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGet(token = 'valid-token') {
  return new NextRequest('http://localhost/api/n8n-templates', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function makePost(body: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/n8n-templates', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

const VALID_WORKFLOW = {
  nodes: [{ name: 'Trigger', type: 'n8n-nodes-base.manualTrigger' }],
  connections: {},
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/n8n-templates', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/n8n-templates');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet() as any)).status).toBe(401);
  });

  it('returns 200 with formatted templates', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // profiles lookup: .select().eq().single()
        const single = vi.fn().mockResolvedValue({ data: { team_id: 'team-1' }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // workflow_templates query: .select('*').order(...).eq(...)
      const eq = vi.fn().mockResolvedValue({
        data: [{
          id: 'tmpl-1',
          name: 'My Workflow',
          description: 'A test template',
          category: 'automation',
          icon: '🤖',
          required_credentials: [],
          import_count: 5,
          is_active: true,
          created_at: '2025-01-01T00:00:00Z',
          updated_at: '2025-01-01T00:00:00Z',
          version: 1,
          changelog: null,
        }],
        error: null,
      });
      const order = vi.fn().mockReturnValue({ eq });
      const select = vi.fn().mockReturnValue({ order });
      return { select };
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.templates).toHaveLength(1);
    expect(body.templates[0].id).toBe('tmpl-1');
    expect(body.templates[0].name).toBe('My Workflow');
  });

  it('returns 200 with empty array when no templates', async () => {
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
        // workflow_templates query - empty: select → order → eq
        const eq = vi.fn().mockResolvedValue({ data: [], error: null });
        const order = vi.fn().mockReturnValue({ eq });
        const select = vi.fn().mockReturnValue({ order });
        return { select };
      }
      // client_instances lookup
      const limit = vi.fn().mockResolvedValue({ data: [], error: null });
      const eq = vi.fn().mockReturnValue({ limit });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await GET(makeGet() as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.templates).toEqual([]);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/n8n-templates', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/n8n-templates', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost({ name: 'Test', workflow_json: VALID_WORKFLOW }) as any)).status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    const res = await POST(makePost({ workflow_json: VALID_WORKFLOW }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Name');
  });

  it('returns 400 when name is empty string', async () => {
    const res = await POST(makePost({ name: '   ', workflow_json: VALID_WORKFLOW }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when workflow_json is missing', async () => {
    const res = await POST(makePost({ name: 'My Template' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Workflow JSON');
  });

  it('returns 400 when workflow_json has no nodes array', async () => {
    const res = await POST(makePost({ name: 'My Template', workflow_json: { connections: {} } }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('nodes');
  });

  it('returns 400 when workflow has empty nodes array', async () => {
    const res = await POST(makePost({ name: 'My Template', workflow_json: { nodes: [], connections: {} } }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('at least one node');
  });

  it('returns 400 when notify_clients is true but SMTP not configured', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await POST(makePost({
      name: 'My Template',
      workflow_json: VALID_WORKFLOW,
      notify_clients: true,
    }) as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.code).toBe('SMTP_NOT_CONFIGURED');
  });

  it('returns 201 with template on successful creation', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // profiles lookup
        const single = vi.fn().mockResolvedValue({ data: { team_id: null }, error: null });
        const eq = vi.fn().mockReturnValue({ single });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // workflow_templates insert
      const single = vi.fn().mockResolvedValue({
        data: {
          id: 'new-tmpl',
          name: 'My Template',
          description: null,
          category: null,
          icon: null,
          required_credentials: [],
          import_count: 0,
          is_active: true,
          created_at: '2025-01-01',
          updated_at: '2025-01-01',
        },
        error: null,
      });
      const select = vi.fn().mockReturnValue({ single });
      const insert = vi.fn().mockReturnValue({ select });
      return { insert };
    });

    const res = await POST(makePost({ name: 'My Template', workflow_json: VALID_WORKFLOW }) as any);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.template.id).toBe('new-tmpl');
    expect(body.emails_sent).toBe(0);
  });
});
