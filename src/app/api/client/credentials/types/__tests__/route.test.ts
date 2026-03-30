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
vi.mock('@/lib/n8nInstanceApi', () => ({
  fetchN8nCredentialTypes: vi.fn().mockResolvedValue({
    credentialTypes: [
      { name: 'googleSheetsOAuth2Api', displayName: 'Google Sheets OAuth2 API', icon: 'google-sheets' },
    ],
    error: null,
  }),
  getCredentialDocUrl: vi.fn((type: string) => `https://docs.example.com/${type}`),
}));
vi.mock('@/lib/n8n/credentialExtractor', () => ({
  CREDENTIAL_MAPPINGS: {
    google_sheets: { type: 'googleSheetsOAuth2Api', name: 'Google Sheets', icon: 'google-sheets' },
    slack: { type: 'slackApi', name: 'Slack', icon: 'slack' },
  },
  checkCredentialStatus: vi.fn(),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INSTANCE_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeGet(instanceId?: string, token = 'valid-token') {
  const url = `http://localhost/api/client/credentials/types${instanceId ? `?instanceId=${instanceId}` : ''}`;
  return new NextRequest(url, { headers: { authorization: `Bearer ${token}` } });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

// Instance found — isOwner case (user_id matches):
// Call 1: pay_per_instance_deployments → select → eq → maybeSingle
// Call 2: client_instances (checkIfUserIsClient) → select → eq → eq → single
function mockOwnerInstance(instanceData: any) {
  let call = 0;
  mockSupabaseAdmin.from.mockImplementation(() => {
    call++;
    if (call === 1) {
      const maybeSingle = vi.fn().mockResolvedValue({ data: instanceData, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    // checkIfUserIsClient: client_instances select → eq → eq → single
    const single = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq2 = vi.fn().mockReturnValue({ single });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    return { select };
  });
}

// Instance not found:
// Call 1: pay_per_instance_deployments → null
// Call 2: n8n_instances fallback → select → eq → eq → neq → maybeSingle → null
function mockNoInstance() {
  let call = 0;
  mockSupabaseAdmin.from.mockImplementation(() => {
    call++;
    if (call === 1) {
      const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    // n8n_instances fallback
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const neq = vi.fn().mockReturnValue({ maybeSingle });
    const eq2 = vi.fn().mockReturnValue({ neq });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    return { select };
  });
}

const OWNER_INSTANCE = {
  id: INSTANCE_ID,
  user_id: 'user-123',
  invited_by_user_id: null,
  instance_url: 'https://n8n.example.com',
  n8n_api_key: 'test-key',
  subscription_status: 'active',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/client/credentials/types', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/client/credentials/types?instanceId=xxx');
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

  it('returns 403 when instance not found', async () => {
    mockNoInstance();
    const res = await GET(makeGet(INSTANCE_ID) as any);
    expect(res.status).toBe(403);
  });

  it('returns credentialTypes from n8n on success', async () => {
    mockOwnerInstance(OWNER_INSTANCE);
    const res = await GET(makeGet(INSTANCE_ID) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(body.credentialTypes)).toBe(true);
    expect(body.credentialTypes.length).toBeGreaterThan(0);
  });

  it('returns fallback list when n8n API fails', async () => {
    const { fetchN8nCredentialTypes } = await import('@/lib/n8nInstanceApi');
    (fetchN8nCredentialTypes as any).mockResolvedValueOnce({ credentialTypes: [], error: 'API unavailable' });

    mockOwnerInstance(OWNER_INSTANCE);
    const res = await GET(makeGet(INSTANCE_ID) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.warning).toContain('built-in');
    expect(Array.isArray(body.credentialTypes)).toBe(true);
  });
});
