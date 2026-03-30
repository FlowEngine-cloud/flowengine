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
  isValidUUID: vi.fn().mockReturnValue(true),
}));
vi.mock('@/lib/evolutionApi', () => ({
  getConnectionState: vi.fn().mockResolvedValue({ ok: true, data: { instance: { state: 'open' } } }),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeGet(instanceId?: string, token = 'valid-token') {
  const url = `http://localhost/api/client/whatsapp-instances${instanceId ? `?instanceId=${instanceId}` : ''}`;
  return new NextRequest(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

// Mock ownership check (call 1) and client check (call 2) with maybeSingle
function mockOwnershipCheck(isOwner: boolean, isClient = false) {
  let call = 0;
  mockSupabaseAdmin.from.mockImplementation(() => {
    call++;
    const result = call === 1 ? (isOwner ? { id: INSTANCE_ID } : null) : (isClient ? { id: 'client-1' } : null);
    const maybeSingle = vi.fn().mockResolvedValue({ data: result, error: null });
    const eq2 = vi.fn().mockReturnValue({ maybeSingle });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    return { select };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/client/whatsapp-instances', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest(`http://localhost/api/client/whatsapp-instances?instanceId=${INSTANCE_ID}`);
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeGet(INSTANCE_ID) as any)).status).toBe(401);
  });

  it('returns 400 when instanceId is missing', async () => {
    const res = await GET(makeGet() as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('instanceId');
  });

  it('returns 400 for invalid UUID', async () => {
    const { isValidUUID } = await import('@/lib/validation');
    (isValidUUID as any).mockReturnValueOnce(false);
    const res = await GET(makeGet('bad-uuid') as any);
    expect(res.status).toBe(400);
  });

  it('returns 403 when user has no access', async () => {
    mockOwnershipCheck(false, false);
    const res = await GET(makeGet(INSTANCE_ID) as any);
    expect(res.status).toBe(403);
  });

  it('returns empty instances array when no WhatsApp instances found', async () => {
    // ownership = true (call 1), then whatsapp_instances query (call 2)
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call <= 1) {
        // ownership check
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: INSTANCE_ID }, error: null });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      // whatsapp_instances: select → eq → is → order
      const order = vi.fn().mockResolvedValue({ data: [], error: null });
      const is = vi.fn().mockReturnValue({ order });
      const eq = vi.fn().mockReturnValue({ is });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await GET(makeGet(INSTANCE_ID) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.instances).toEqual([]);
  });

  it('returns instances with live status', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call <= 1) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: INSTANCE_ID }, error: null });
        const eq2 = vi.fn().mockReturnValue({ maybeSingle });
        const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
        const select = vi.fn().mockReturnValue({ eq: eq1 });
        return { select };
      }
      const order = vi.fn().mockResolvedValue({
        data: [{
          id: 'wa-1', instance_name: 'session-1', display_name: 'My WhatsApp',
          phone_number: '+1234567890', status: 'disconnected', webhook_url: null,
          session_token: 'token-abc', server_url: 'https://evo.example.com',
        }],
        error: null,
      });
      const is = vi.fn().mockReturnValue({ order });
      const eq = vi.fn().mockReturnValue({ is });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await GET(makeGet(INSTANCE_ID) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.instances).toHaveLength(1);
    // 'open' state maps to 'connected'
    expect(body.instances[0].status).toBe('connected');
  });
});
