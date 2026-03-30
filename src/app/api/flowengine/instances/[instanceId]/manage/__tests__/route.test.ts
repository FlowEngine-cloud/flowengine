import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockFEClient } = vi.hoisted(() => {
  const mockFEClient = {
    manageInstance: vi.fn().mockResolvedValue({ success: true, status: 'running' }),
  };
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() } };
  return { mockSupabaseAdmin, mockFEClient };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/flowengineAccess', () => ({
  verifyFlowEngineAccess: vi.fn().mockResolvedValue({ authorized: true, effectiveUserId: 'user-123' }),
}));
vi.mock('@/lib/portalSettings', () => ({
  getPortalSettings: vi.fn().mockResolvedValue({ flowengine_api_key: 'fe_key' }),
}));
vi.mock('@/lib/flowengine', () => ({
  createFlowEngineClient: vi.fn().mockReturnValue(mockFEClient),
  FlowEngineApiError: class FlowEngineApiError extends Error {
    status: number; code: string;
    constructor(status: number, code: string, message: string) {
      super(message); this.status = status; this.code = code;
    }
  },
}));

import { POST } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'fe-inst-abc123';

function makePost(body: Record<string, any>, token = 'valid-token') {
  return new NextRequest(`http://localhost/api/flowengine/instances/${INSTANCE_ID}/manage`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /api/flowengine/instances/[instanceId]/manage', () => {
  it('returns 401 without authorization', async () => {
    const req = new NextRequest(`http://localhost/api/flowengine/instances/${INSTANCE_ID}/manage`, { method: 'POST' });
    expect((await POST(req as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) })).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makePost({ action: 'start' }) as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) })).status).toBe(401);
  });

  it('returns 400 for invalid action', async () => {
    const res = await POST(makePost({ action: 'reboot' }) as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid_action');
  });

  it('returns 400 when no API key configured', async () => {
    const { createFlowEngineClient } = await import('@/lib/flowengine');
    (createFlowEngineClient as any).mockReturnValueOnce(null);
    const res = await POST(makePost({ action: 'start' }) as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) });
    expect(res.status).toBe(400);
  });

  it.each(['start', 'stop', 'restart'])('returns 200 for action %s', async (action) => {
    const res = await POST(makePost({ action }) as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) });
    expect(res.status).toBe(200);
    expect((await res.json()).success).toBe(true);
  });

  it('forwards FlowEngineApiError status', async () => {
    const { FlowEngineApiError } = await import('@/lib/flowengine');
    mockFEClient.manageInstance.mockRejectedValueOnce(
      new (FlowEngineApiError as any)(404, 'not_found', 'Instance not found')
    );
    const res = await POST(makePost({ action: 'start' }) as any, { params: Promise.resolve({ instanceId: INSTANCE_ID }) });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
  });
});
