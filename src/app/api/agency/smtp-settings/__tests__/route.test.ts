import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockSupabaseAdmin, mockVerify } = vi.hoisted(() => {
  const mockVerify = vi.fn().mockResolvedValue(true);
  const mockSupabaseAdmin = { auth: { getUser: vi.fn() }, from: vi.fn() };
  return { mockSupabaseAdmin, mockVerify };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabaseAdmin }));
vi.mock('@/lib/encryption', () => ({
  encrypt: vi.fn((v: string) => `enc:${v}`),
  decrypt: vi.fn((v: string) => v.replace('enc:', '')),
}));
vi.mock('@/lib/validation', () => ({
  checkRateLimit: vi.fn().mockReturnValue({ allowed: true }),
}));
vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ verify: mockVerify })),
  },
}));

import { GET, POST, DELETE } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SMTP_BODY = {
  host: 'smtp.example.com',
  port: 587,
  user: 'user@example.com',
  password: 'secret123',
  sender: 'noreply@example.com',
};

function makeReq(method: string, body?: any, token = 'valid-token') {
  return new NextRequest('http://localhost/api/agency/smtp-settings', {
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

function mockProfile(data: any | null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

function mockSingle(data: any | null) {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { select };
}

function mockUpdate() {
  const eq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq });
  return { update };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth({ id: 'user-123' });
  mockVerify.mockResolvedValue(true);
});

// ─── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/agency/smtp-settings', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/agency/smtp-settings');
    expect((await GET(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await GET(makeReq('GET') as any)).status).toBe(401);
  });

  it('returns SMTP status when configured', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        agency_smtp_host: 'smtp.example.com',
        agency_smtp_port: 587,
        agency_smtp_user: 'user@example.com',
        agency_smtp_sender: 'noreply@example.com',
        agency_smtp_enabled: true,
      },
      error: null,
    });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeReq('GET') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.enabled).toBe(true);
    expect(body.host).toBe('smtp.example.com');
  });

  it('returns defaults when no SMTP configured', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabaseAdmin.from.mockReturnValue({ select });

    const res = await GET(makeReq('GET') as any);
    const body = await res.json();
    expect(body.enabled).toBe(false);
    expect(body.host).toBeNull();
    expect(body.port).toBe(587);
  });
});

// ─── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/agency/smtp-settings', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/agency/smtp-settings', { method: 'POST' });
    expect((await POST(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await POST(makeReq('POST', SMTP_BODY) as any)).status).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    const { checkRateLimit } = await import('@/lib/validation');
    (checkRateLimit as any).mockReturnValueOnce({ allowed: false });
    // profile check runs before rate limit check
    mockSupabaseAdmin.from.mockReturnValue(mockProfile({ id: 'user-123' }));
    const res = await POST(makeReq('POST', SMTP_BODY) as any);
    expect(res.status).toBe(429);
  });

  it('returns 404 when profile not found', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockProfile(null));
    const res = await POST(makeReq('POST', SMTP_BODY) as any);
    expect(res.status).toBe(404);
  });

  it('returns 400 when required fields are missing', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockProfile({ id: 'user-123' });
      return mockSingle({ agency_smtp_enabled: false, agency_smtp_pass_encrypted: null });
    });

    const res = await POST(makeReq('POST', { port: 587 }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Required fields');
  });

  it('returns 400 for invalid sender email format', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockProfile({ id: 'user-123' });
      return mockSingle({ agency_smtp_enabled: false, agency_smtp_pass_encrypted: null });
    });

    const res = await POST(makeReq('POST', { ...SMTP_BODY, sender: 'not-an-email' }) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('sender email');
  });

  it('returns 400 when SMTP connection fails', async () => {
    mockVerify.mockRejectedValueOnce(new Error('Connection refused'));

    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockProfile({ id: 'user-123' });
      return mockSingle({ agency_smtp_enabled: false, agency_smtp_pass_encrypted: null });
    });

    const res = await POST(makeReq('POST', SMTP_BODY) as any);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('SMTP connection failed');
  });

  it('returns 200 on successful SMTP save', async () => {
    let call = 0;
    mockSupabaseAdmin.from.mockImplementation(() => {
      call++;
      if (call === 1) return mockProfile({ id: 'user-123' });
      if (call === 2) return mockSingle({ agency_smtp_enabled: false, agency_smtp_pass_encrypted: null });
      return mockUpdate();
    });

    const res = await POST(makeReq('POST', SMTP_BODY) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});

// ─── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/agency/smtp-settings', () => {
  it('returns 401 without Authorization header', async () => {
    const req = new NextRequest('http://localhost/api/agency/smtp-settings', { method: 'DELETE' });
    expect((await DELETE(req as any)).status).toBe(401);
  });

  it('returns 401 for invalid token', async () => {
    mockAuth(null);
    expect((await DELETE(makeReq('DELETE') as any)).status).toBe(401);
  });

  it('returns 200 on successful SMTP disable', async () => {
    mockSupabaseAdmin.from.mockReturnValue(mockUpdate());
    const res = await DELETE(makeReq('DELETE') as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
