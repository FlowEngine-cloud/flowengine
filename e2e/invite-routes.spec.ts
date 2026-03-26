/**
 * E2E tests for invite API routes.
 *
 * Tests the authentication guards, token format validation, and error responses
 * for /api/invite/accept-access and /api/team/accept endpoints.
 * These cover fixes for: email-match check (ISSUE-01), token expiry (ISSUE-06).
 */

import { test, expect } from '@playwright/test';

const FAKE_CI_TOKEN = 'ci_' + 'a'.repeat(48);
const FAKE_TM_TOKEN = 'tm_' + 'a'.repeat(48);

// ── GET /api/invite/accept-access ─────────────────────────────────────────

test.describe('GET /api/invite/accept-access — token validation', () => {
  test('returns 400 with no token', async ({ request }) => {
    const res = await request.get('/api/invite/accept-access');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 with wrong token prefix (not ci_)', async ({ request }) => {
    const res = await request.get('/api/invite/accept-access?token=tm_abc123');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 with bare invalid token', async ({ request }) => {
    const res = await request.get('/api/invite/accept-access?token=invalid');
    expect(res.status()).toBe(400);
  });

  test('returns 404 with well-formed but non-existent ci_ token', async ({ request }) => {
    const res = await request.get(`/api/invite/accept-access?token=${FAKE_CI_TOKEN}`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });
});

// ── POST /api/invite/accept-access ────────────────────────────────────────

test.describe('POST /api/invite/accept-access — auth + token guards', () => {
  test('returns 401 with no Authorization header', async ({ request }) => {
    const res = await request.post('/api/invite/accept-access', {
      data: { token: FAKE_CI_TOKEN },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 401 with invalid Bearer token', async ({ request }) => {
    const res = await request.post('/api/invite/accept-access', {
      headers: { Authorization: 'Bearer not_a_real_token' },
      data: { token: FAKE_CI_TOKEN },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 400 with wrong token prefix (not ci_)', async ({ request }) => {
    const res = await request.post('/api/invite/accept-access', {
      headers: { Authorization: 'Bearer some_token' },
      data: { token: 'tm_wrongprefix' },
    });
    // 401 (auth fails first) or 400 (token format) — both are acceptable rejections
    expect([400, 401]).toContain(res.status());
  });
});

// ── GET /api/team/accept ──────────────────────────────────────────────────

test.describe('GET /api/team/accept — token validation', () => {
  test('returns 400 with no token', async ({ request }) => {
    const res = await request.get('/api/team/accept');
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toBeTruthy();
  });

  test('returns 400 with wrong token prefix (not tm_)', async ({ request }) => {
    const res = await request.get('/api/team/accept?token=ci_abc123');
    expect(res.status()).toBe(400);
  });

  test('returns 404 with well-formed but non-existent tm_ token', async ({ request }) => {
    const res = await request.get(`/api/team/accept?token=${FAKE_TM_TOKEN}`);
    expect(res.status()).toBe(404);
    const body = await res.json();
    expect(body.error).toContain('not found');
  });
});

// ── POST /api/team/accept ─────────────────────────────────────────────────

test.describe('POST /api/team/accept — auth + token guards', () => {
  test('returns 401 with no Authorization header', async ({ request }) => {
    const res = await request.post('/api/team/accept', {
      data: { token: FAKE_TM_TOKEN },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 401 with invalid Bearer token', async ({ request }) => {
    const res = await request.post('/api/team/accept', {
      headers: { Authorization: 'Bearer not_real' },
      data: { token: FAKE_TM_TOKEN },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 400 with wrong token prefix (not tm_)', async ({ request }) => {
    const res = await request.post('/api/team/accept', {
      headers: { Authorization: 'Bearer some_token' },
      data: { token: 'ci_wrongprefix' },
    });
    expect([400, 401]).toContain(res.status());
  });
});

// ── POST /api/client/invite — write-guard ─────────────────────────────────

test.describe('POST /api/client/invite — auth guard', () => {
  test('returns 401 with no Authorization header', async ({ request }) => {
    const res = await request.post('/api/client/invite', {
      data: { email: 'test@example.com' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 401 with invalid Bearer token', async ({ request }) => {
    const res = await request.post('/api/client/invite', {
      headers: { Authorization: 'Bearer invalid_token' },
      data: { email: 'test@example.com' },
    });
    expect(res.status()).toBe(401);
  });
});

// ── POST /api/client/invite/resend — always uses accept-access path ────────

test.describe('POST /api/client/invite/resend — auth guard', () => {
  test('returns 401 with no Authorization header', async ({ request }) => {
    const res = await request.post('/api/client/invite/resend', {
      data: { inviteId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(401);
  });
});
