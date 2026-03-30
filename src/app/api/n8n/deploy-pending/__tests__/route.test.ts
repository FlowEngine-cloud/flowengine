import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockFlowEngineClient } = vi.hoisted(() => {
  const mockFlowEngineClient = {
    createInstance: vi.fn().mockResolvedValue({
      instance: { instance_url: 'https://n8n.example.com' },
    }),
  };
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin, mockFlowEngineClient };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/teamAccess', () => ({
  resolveEffectiveUserId: vi.fn().mockResolvedValue('user-123'),
}));
vi.mock('@/lib/portalSettings', () => ({
  getPortalSettings: vi.fn().mockResolvedValue({ flowengine_api_key: 'fe_test_key' }),
}));
vi.mock('@/lib/flowengine', () => ({
  createFlowEngineClient: vi.fn().mockReturnValue(mockFlowEngineClient),
  FlowEngineApiError: class FlowEngineApiError extends Error {
    status: number; code: string;
    constructor(status: number, code: string, message: string) {
      super(message); this.status = status; this.code = code;
    }
  },
}));
vi.mock('@/lib/validation', () => ({
  isValidUUID: vi.fn().mockReturnValue(true),
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makePost(body: Record<string, any>, token = 'valid-token') {
  return new NextRequest('http://localhost/api/n8n/deploy-pending', {
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

function mockInstance(data: Record<string, any> | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/n8n/deploy-pending', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/n8n/deploy-pending', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost({ instanceId: INSTANCE_ID, serviceType: 'n8n' }) as any)).status).toBe(401);
  });

  it('returns 400 when instanceId is missing', async () => {
    // No instanceId in body — short-circuits to 'Valid instanceId is required'
    const res = await POST(makePost({ serviceType: 'n8n' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('instanceId');
  });

  it('returns 400 when serviceType is missing', async () => {
    const res = await POST(makePost({ instanceId: INSTANCE_ID }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('serviceType');
  });

  it('returns 404 when instance not found', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockInstance(null));
    const res = await POST(makePost({ instanceId: INSTANCE_ID, serviceType: 'n8n' }) as any);
    expect(res.status).toBe(404);
  });

  it('returns 403 when user does not own the instance', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockInstance({
      id: INSTANCE_ID, user_id: 'other-user', invited_by_user_id: 'other-manager',
      instance_name: 'Test', storage_limit_gb: 10, billing_cycle: 'monthly',
      status: 'pending_deploy', service_type: 'n8n', platform: null,
    }));
    const res = await POST(makePost({ instanceId: INSTANCE_ID, serviceType: 'n8n' }) as any);
    expect(res.status).toBe(403);
  });

  it('returns 400 when instance is in non-deployable state', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockInstance({
      id: INSTANCE_ID, user_id: 'user-123', invited_by_user_id: null,
      instance_name: 'Test', storage_limit_gb: 10, billing_cycle: 'monthly',
      status: 'active', service_type: 'n8n', platform: null,
    }));
    const res = await POST(makePost({ instanceId: INSTANCE_ID, serviceType: 'n8n' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('active');
  });

  it('returns 400 when no FlowEngine API key configured', async () => {
    const { getPortalSettings } = await import('@/lib/portalSettings');
    (getPortalSettings as any).mockResolvedValueOnce({ flowengine_api_key: null });
    const { createFlowEngineClient } = await import('@/lib/flowengine');
    (createFlowEngineClient as any).mockReturnValueOnce(null);

    mockSupabaseAdmin.from.mockReturnValue(mockInstance({
      id: INSTANCE_ID, user_id: 'user-123', invited_by_user_id: null,
      instance_name: 'Test', storage_limit_gb: 10, billing_cycle: 'monthly',
      status: 'pending_deploy', service_type: 'n8n', platform: null,
    }));

    const res = await POST(makePost({ instanceId: INSTANCE_ID, serviceType: 'n8n' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('FlowEngine API key');
  });

  it('returns 200 on successful n8n deployment', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        return mockInstance({
          id: INSTANCE_ID, user_id: 'user-123', invited_by_user_id: null,
          instance_name: 'Test', storage_limit_gb: 10, billing_cycle: 'monthly',
          status: 'pending_deploy', service_type: 'n8n', platform: null,
        });
      }
      // update: update → eq
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq });
      return { update };
    });

    const res = await POST(makePost({ instanceId: INSTANCE_ID, serviceType: 'n8n' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.instance.id).toBe(INSTANCE_ID);
  });

  it('returns FlowEngineApiError status on API error', async () => {
    const { FlowEngineApiError } = await import('@/lib/flowengine');
    mockFlowEngineClient.createInstance.mockRejectedValueOnce(
      new (FlowEngineApiError as any)(402, 'payment_required', 'Payment required')
    );

    mockSupabaseAdmin.from.mockReturnValue(mockInstance({
      id: INSTANCE_ID, user_id: 'user-123', invited_by_user_id: null,
      instance_name: 'Test', storage_limit_gb: 10, billing_cycle: 'monthly',
      status: 'pending_deploy', service_type: 'n8n', platform: null,
    }));

    const res = await POST(makePost({ instanceId: INSTANCE_ID, serviceType: 'n8n' }) as any);
    expect(res.status).toBe(402);
  });

  it('returns 200 on docker deployment when Coolify configured', async () => {
    process.env.COOLIFY_API_TOKEN = 'test-token';
    process.env.COOLIFY_API_URL = 'https://coolify.example.com';

    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) {
        return mockInstance({
          id: INSTANCE_ID, user_id: 'user-123', invited_by_user_id: null,
          instance_name: 'Test', storage_limit_gb: 10, billing_cycle: 'monthly',
          status: 'pending_deploy', service_type: 'docker', platform: null,
        });
      }
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockReturnValue({ eq });
      return { update };
    });

    const res = await POST(makePost({ instanceId: INSTANCE_ID, serviceType: 'docker' }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);

    delete process.env.COOLIFY_API_TOKEN;
    delete process.env.COOLIFY_API_URL;
  });

  it('returns 400 for docker without Coolify configured', async () => {
    delete process.env.COOLIFY_API_TOKEN;
    delete process.env.COOLIFY_API_URL;

    mockSupabaseAdmin.from.mockReturnValue(mockInstance({
      id: INSTANCE_ID, user_id: 'user-123', invited_by_user_id: null,
      instance_name: 'Test', storage_limit_gb: 10, billing_cycle: 'monthly',
      status: 'pending_deploy', service_type: 'docker', platform: null,
    }));

    const res = await POST(makePost({ instanceId: INSTANCE_ID, serviceType: 'docker' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Coolify');
  });

  it('returns 400 for unsupported service type', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockInstance({
      id: INSTANCE_ID, user_id: 'user-123', invited_by_user_id: null,
      instance_name: 'Test', storage_limit_gb: 10, billing_cycle: 'monthly',
      status: 'pending_deploy', service_type: 'other', platform: null,
    }));

    const res = await POST(makePost({ instanceId: INSTANCE_ID, serviceType: 'other' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("'other'");
  });
});
