import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/apiKeyAuth', () => ({
  validateApiKey: vi.fn().mockResolvedValue('user-123'),
}));

import { GET as getClients } from '../clients/route';
import { GET as getInstances } from '../instances/route';
import { GET as getWorkflows } from '../workflows/route';
import { GET as getPortals } from '../portals/route';
import { GET as getComponents } from '../components/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeGet(path: string, token = 'fp_valid-token') {
  return new NextRequest(`http://localhost${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function mockAuthFail() {
  const { validateApiKey } = require('@/lib/apiKeyAuth');
  validateApiKey.mockResolvedValueOnce(null);
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── GET /api/mcp/clients ─────────────────────────────────────────────────────

describe('GET /api/mcp/clients', () => {
  it('returns 401 for invalid API key', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValueOnce(null);
    expect((await getClients(makeGet('/api/mcp/clients') as any)).status).toBe(401);
  });

  it('returns 200 with clients list', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // client_invites: select → eq → order
        const order = vi.fn().mockResolvedValue({ data: [{ id: 'inv-1', email: 'client@test.com', status: 'accepted', linked_instance_ids: ['inst-1'] }], error: null });
        const eq = vi.fn().mockReturnValue({ order });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // pay_per_instance_deployments: select → eq → is
      const is = vi.fn().mockResolvedValue({ data: [], error: null });
      const eq = vi.fn().mockReturnValue({ is });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await getClients(makeGet('/api/mcp/clients') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.clients)).toBe(true);
    expect(body.clients[0].instance_count).toBe(1);
  });

  it('returns 500 when DB query fails', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await getClients(makeGet('/api/mcp/clients') as any);
    expect(res.status).toBe(500);
  });
});

// ─── GET /api/mcp/instances ───────────────────────────────────────────────────

describe('GET /api/mcp/instances', () => {
  it('returns 401 for invalid API key', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValueOnce(null);
    expect((await getInstances(makeGet('/api/mcp/instances') as any)).status).toBe(401);
  });

  it('returns 200 with instances list', async () => {
    const order = vi.fn().mockResolvedValue({ data: [{ id: 'inst-1', instance_name: 'My n8n', status: 'active' }], error: null });
    const is = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ is });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await getInstances(makeGet('/api/mcp/instances') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.instances).toHaveLength(1);
  });

  it('returns 500 when DB query fails', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const is = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ is });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    expect((await getInstances(makeGet('/api/mcp/instances') as any)).status).toBe(500);
  });
});

// ─── GET /api/mcp/workflows ───────────────────────────────────────────────────

describe('GET /api/mcp/workflows', () => {
  it('returns 401 for invalid API key', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValueOnce(null);
    expect((await getWorkflows(makeGet('/api/mcp/workflows') as any)).status).toBe(401);
  });

  it('returns 200 with workflows', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        // workflow_templates (built first, synchronously): select → order → or (awaited at end)
        const or = vi.fn().mockResolvedValue({ data: [{ id: 'tmpl-1', name: 'Test' }], error: null });
        const order = vi.fn().mockReturnValue({ or });
        const select = vi.fn().mockReturnValue({ order });
        return { select };
      }
      // profiles lookup (call 2): select → eq → single
      const single = vi.fn().mockResolvedValue({ data: { team_id: null }, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await getWorkflows(makeGet('/api/mcp/workflows') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(Array.isArray(body.workflows)).toBe(true);
  });
});

// ─── GET /api/mcp/portals ─────────────────────────────────────────────────────

describe('GET /api/mcp/portals', () => {
  it('returns 401 for invalid API key', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValueOnce(null);
    expect((await getPortals(makeGet('/api/mcp/portals') as any)).status).toBe(401);
  });

  it('returns 200 with portals list', async () => {
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'portal-1', instance_name: 'My n8n', status: 'active' }],
      error: null,
    });
    const is = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ is });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await getPortals(makeGet('/api/mcp/portals') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.portals).toHaveLength(1);
  });

  it('returns 500 when DB query fails', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const is = vi.fn().mockReturnValue({ order });
    const eq = vi.fn().mockReturnValue({ is });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    expect((await getPortals(makeGet('/api/mcp/portals') as any)).status).toBe(500);
  });
});

// ─── GET /api/mcp/components ──────────────────────────────────────────────────

describe('GET /api/mcp/components', () => {
  it('returns 401 for invalid API key', async () => {
    const { validateApiKey } = await import('@/lib/apiKeyAuth');
    (validateApiKey as any).mockResolvedValueOnce(null);
    expect((await getComponents(makeGet('/api/mcp/components') as any)).status).toBe(401);
  });

  it('returns 200 with components list', async () => {
    // select → eq → order (no instanceId filter)
    const order = vi.fn().mockResolvedValue({
      data: [{ id: 'widget-1', name: 'My Widget', widget_type: 'form' }],
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await getComponents(makeGet('/api/mcp/components') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.components).toHaveLength(1);
  });

  it('returns 500 when DB query fails', async () => {
    const order = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } });
    const eq = vi.fn().mockReturnValue({ order });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    expect((await getComponents(makeGet('/api/mcp/components') as any)).status).toBe(500);
  });
});
