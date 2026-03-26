import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin } = vi.hoisted(() => {
  const getUser = vi.fn();
  const from = vi.fn();
  const mockSupabaseAdmin = { auth: { getUser }, from };
  return { mockSupabaseAdmin };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));

vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((v: string) => `encrypted:${v}`),
  decrypt: vi.fn((v: string) => v.replace('encrypted:', '')),
}));

vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true, remaining: 4, resetIn: 60000 }),
}));

// nodemailer mock — verify() succeeds by default
const { mockVerify, mockCreateTransport } = vi.hoisted(() => {
  const mockVerify = vi.fn().mockResolvedValue(true);
  const mockCreateTransport = vi.fn().mockReturnValue({ verify: mockVerify });
  return { mockVerify, mockCreateTransport };
});
vi.mock('nodemailer', () => ({ default: { createTransport: mockCreateTransport } }));

import { POST, DELETE, GET } from '../smtp-settings/route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(method: 'POST' | 'DELETE' | 'GET', body?: Record<string, any>, token = 'valid-token') {
  return new Request('http://localhost/api/agency/smtp-settings', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

function mockAuth(user: { id: string } | null) {
  mockSupabaseAdmin.auth.getUser.mockResolvedValue({
    data: { user },
    error: user ? null : { message: 'Unauthorized' },
  });
}

const VALID_SMTP = {
  host: 'smtp.example.com',
  port: 587,
  user: 'sender@example.com',
  password: 'secret123',
  sender: 'sender@example.com',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
  mockVerify.mockResolvedValue(true);
});

// ─── POST tests ───────────────────────────────────────────────────────────────

describe('POST /api/agency/smtp-settings', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = new Request('http://localhost/api/agency/smtp-settings', {
      method: 'POST',
      body: JSON.stringify(VALID_SMTP),
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth(null);
    const res = await POST(makeRequest('POST', VALID_SMTP) as any);
    expect(res.status).toBe(401);
  });

  it('returns 404 when user profile does not exist', async () => {
    // First from() call: profile existence check
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await POST(makeRequest('POST', VALID_SMTP) as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 when required fields are missing (no host)', async () => {
    let callCount = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // profile exists
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null });
        const eq = vi.fn().mockReturnValue({ maybeSingle });
        const select = vi.fn().mockReturnValue({ eq });
        return { select };
      }
      // existing SMTP check
      const single = vi.fn().mockResolvedValue({ data: { agency_smtp_enabled: false }, error: null });
      const eq = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    });

    const res = await POST(makeRequest('POST', { ...VALID_SMTP, host: '' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when sender email format is invalid', async () => {
    let callCount = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null });
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) };
      }
      const single = vi.fn().mockResolvedValue({ data: { agency_smtp_enabled: false }, error: null });
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }) };
    });

    const res = await POST(makeRequest('POST', { ...VALID_SMTP, sender: 'not-an-email' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when password missing on first setup', async () => {
    let callCount = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null });
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) };
      }
      // existing: not configured
      const single = vi.fn().mockResolvedValue({
        data: { agency_smtp_enabled: false, agency_smtp_pass_encrypted: null },
        error: null,
      });
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }) };
    });

    const { password: _, ...noPassword } = VALID_SMTP;
    const res = await POST(makeRequest('POST', noPassword) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when SMTP verification fails', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Connection refused'));
    let callCount = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null });
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) };
      }
      const single = vi.fn().mockResolvedValue({ data: { agency_smtp_enabled: false }, error: null });
      return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }) };
    });

    const res = await POST(makeRequest('POST', VALID_SMTP) as any);
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/SMTP connection failed/i);
  });

  it('returns 200 and saves encrypted password on success', async () => {
    let capturedUpdate: Record<string, any> = {};
    let callCount = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null });
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }) };
      }
      if (callCount === 2) {
        const single = vi.fn().mockResolvedValue({ data: { agency_smtp_enabled: false }, error: null });
        return { select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single }) }) };
      }
      // update
      const eq = vi.fn().mockResolvedValue({ error: null });
      const update = vi.fn().mockImplementation((data) => { capturedUpdate = data; return { eq }; });
      return { update };
    });

    const res = await POST(makeRequest('POST', VALID_SMTP) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(capturedUpdate.agency_smtp_pass_encrypted).toBe(`encrypted:${VALID_SMTP.password}`);
    expect(capturedUpdate.agency_smtp_enabled).toBe(true);
  });

  it('returns 429 when rate limit is exceeded', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false, remaining: 0, resetIn: 30000 });

    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: 'user-123' }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await POST(makeRequest('POST', VALID_SMTP) as any);
    expect(res.status).toBe(429);
  });
});

// ─── DELETE tests ─────────────────────────────────────────────────────────────

describe('DELETE /api/agency/smtp-settings', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = new Request('http://localhost/api/agency/smtp-settings', { method: 'DELETE' });
    const res = await DELETE(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth(null);
    const res = await DELETE(makeRequest('DELETE') as any);
    expect(res.status).toBe(401);
  });

  it('clears SMTP settings and returns success', async () => {
    let capturedUpdate: Record<string, any> = {};
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockImplementation((data) => { capturedUpdate = data; return { eq }; });
    mockSupabaseAdmin.from.mockReturnValue({ update });

    const res = await DELETE(makeRequest('DELETE') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(capturedUpdate.agency_smtp_enabled).toBe(false);
    expect(capturedUpdate.agency_smtp_pass_encrypted).toBeNull();
    expect(capturedUpdate.agency_smtp_host).toBeNull();
  });

  it('returns 500 when DB update fails', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'DB error' } });
    const update = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ update });

    const res = await DELETE(makeRequest('DELETE') as any);
    expect(res.status).toBe(500);
  });
});

// ─── GET tests ────────────────────────────────────────────────────────────────

describe('GET /api/agency/smtp-settings', () => {
  it('returns 401 when no Authorization header', async () => {
    const req = new Request('http://localhost/api/agency/smtp-settings');
    const res = await GET(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 401 when token is invalid', async () => {
    mockAuth(null);
    const res = await GET(makeRequest('GET') as any);
    expect(res.status).toBe(401);
  });

  it('returns SMTP status for configured user', async () => {
    const profile = {
      agency_smtp_host: 'smtp.example.com',
      agency_smtp_port: 587,
      agency_smtp_user: 'user@example.com',
      agency_smtp_sender: 'sender@example.com',
      agency_smtp_enabled: true,
    };
    const maybeSingle = vi.fn().mockResolvedValue({ data: profile, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest('GET') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.host).toBe('smtp.example.com');
    expect(body.port).toBe(587);
  });

  it('returns defaults when no SMTP profile exists', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeRequest('GET') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.enabled).toBe(false);
    expect(body.host).toBeNull();
    expect(body.port).toBe(587);
  });
});
