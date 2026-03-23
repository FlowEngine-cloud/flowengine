/**
 * E2E tests for API key management routes.
 *
 * These tests verify the /api/user/api-keys/* and /api/v1/* endpoints behave
 * correctly for both authenticated (session) and API-key-authenticated requests.
 *
 * Tests that require a valid fp_ key are skipped unless TEST_API_KEY is set in env.
 */

import { test, expect } from '@playwright/test';

// ── /api/user/api-keys/info ─────────────────────────────────────────────────

test.describe('GET /api/user/api-keys/info', () => {
  test('returns 401 without a session cookie', async ({ request }) => {
    const res = await request.get('/api/user/api-keys/info');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ── /api/user/api-keys/regenerate ──────────────────────────────────────────

test.describe('POST /api/user/api-keys/regenerate', () => {
  test('returns 401 without a session cookie', async ({ request }) => {
    const res = await request.post('/api/user/api-keys/regenerate');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
  });
});

// ── /api/v1/me ─────────────────────────────────────────────────────────────

test.describe('GET /api/v1/me', () => {
  test('returns 401 with no Authorization header', async ({ request }) => {
    const res = await request.get('/api/v1/me');
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Unauthorized');
  });

  test('returns 401 with a plain Bearer token (not fp_ prefix)', async ({ request }) => {
    const res = await request.get('/api/v1/me', {
      headers: { Authorization: 'Bearer somerandominvalidkey' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 401 with a fe_ prefixed key (FlowEngine Cloud key, wrong portal)', async ({ request }) => {
    const res = await request.get('/api/v1/me', {
      headers: { Authorization: 'Bearer fe_9fa2a441ec32f8259c13b68efb4855b74e9d037d1' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 401 with a well-formed but non-existent fp_ key', async ({ request }) => {
    const res = await request.get('/api/v1/me', {
      headers: { Authorization: 'Bearer fp_' + 'a'.repeat(64) },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 200 and user profile with valid TEST_API_KEY', async ({ request }) => {
    const key = process.env.TEST_API_KEY;
    if (!key) return test.skip();

    const res = await request.get('/api/v1/me', {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(typeof body.data.id).toBe('string');
  });
});

// ── /api/v1/instances ──────────────────────────────────────────────────────

test.describe('GET /api/v1/instances', () => {
  test('returns 401 with no Authorization header', async ({ request }) => {
    const res = await request.get('/api/v1/instances');
    expect(res.status()).toBe(401);
  });

  test('returns 401 with invalid key', async ({ request }) => {
    const res = await request.get('/api/v1/instances', {
      headers: { Authorization: 'Bearer fp_invalid' },
    });
    expect(res.status()).toBe(401);
  });

  test('returns 200 and instances array with valid TEST_API_KEY', async ({ request }) => {
    const key = process.env.TEST_API_KEY;
    if (!key) return test.skip();

    const res = await request.get('/api/v1/instances', {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
