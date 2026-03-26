/**
 * E2E tests for /api/mcp/* routes.
 *
 * All MCP routes require an fp_ Bearer token. These tests verify that:
 *  - Unauthenticated requests are rejected with 401
 *  - Wrong key formats are rejected
 *  - Valid keys (TEST_API_KEY env var) return the correct response shape
 */

import { test, expect } from '@playwright/test';

// Helper — skip test if no TEST_API_KEY is configured
function validKeyHeaders() {
  const key = process.env.TEST_API_KEY;
  if (!key) return null;
  return { Authorization: `Bearer ${key}` };
}

// ── Auth guard: all routes must reject unauthenticated requests ─────────────

const MCP_ROUTES = [
  '/api/mcp/portals',
  '/api/mcp/instances',
  '/api/mcp/workflows',
  '/api/mcp/components',
  '/api/mcp/clients',
];

for (const route of MCP_ROUTES) {
  test.describe(`GET ${route}`, () => {
    test('returns 401 with no Authorization header', async ({ request }) => {
      const res = await request.get(route);
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Unauthorized');
    });

    test('returns 401 with a non-fp_ Bearer token', async ({ request }) => {
      const res = await request.get(route, {
        headers: { Authorization: 'Bearer not_a_portal_key' },
      });
      expect(res.status()).toBe(401);
    });

    test('returns 401 with a well-formed but unknown fp_ key', async ({ request }) => {
      const res = await request.get(route, {
        headers: { Authorization: 'Bearer fp_' + '0'.repeat(64) },
      });
      expect(res.status()).toBe(401);
    });
  });
}

// ── /api/mcp/portals ───────────────────────────────────────────────────────

test.describe('GET /api/mcp/portals — authenticated', () => {
  test('returns portals array', async ({ request }) => {
    const headers = validKeyHeaders();
    if (!headers) return test.skip();

    const res = await request.get('/api/mcp/portals', { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.portals)).toBe(true);
  });

  test('portal items have expected fields', async ({ request }) => {
    const headers = validKeyHeaders();
    if (!headers) return test.skip();

    const res = await request.get('/api/mcp/portals', { headers });
    const body = await res.json();

    for (const portal of body.portals) {
      expect(typeof portal.id).toBe('string');
      expect(typeof portal.instance_name).toBe('string');
      expect(typeof portal.status).toBe('string');
    }
  });
});

// ── /api/mcp/instances ─────────────────────────────────────────────────────

test.describe('GET /api/mcp/instances — authenticated', () => {
  test('returns instances array', async ({ request }) => {
    const headers = validKeyHeaders();
    if (!headers) return test.skip();

    const res = await request.get('/api/mcp/instances', { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.instances)).toBe(true);
  });

  test('instance items have expected fields', async ({ request }) => {
    const headers = validKeyHeaders();
    if (!headers) return test.skip();

    const res = await request.get('/api/mcp/instances', { headers });
    const body = await res.json();

    for (const inst of body.instances) {
      expect(typeof inst.id).toBe('string');
      expect(typeof inst.instance_name).toBe('string');
      expect(typeof inst.status).toBe('string');
    }
  });
});

// ── /api/mcp/workflows ─────────────────────────────────────────────────────

test.describe('GET /api/mcp/workflows — authenticated', () => {
  test('returns workflows array', async ({ request }) => {
    const headers = validKeyHeaders();
    if (!headers) return test.skip();

    const res = await request.get('/api/mcp/workflows', { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.workflows)).toBe(true);
  });

  test('accepts optional instanceId query param', async ({ request }) => {
    const headers = validKeyHeaders();
    if (!headers) return test.skip();

    const res = await request.get('/api/mcp/workflows?instanceId=test-id', { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.workflows)).toBe(true);
  });
});

// ── /api/mcp/clients ──────────────────────────────────────────────────────

test.describe('GET /api/mcp/clients — authenticated', () => {
  test('returns clients array', async ({ request }) => {
    const headers = validKeyHeaders();
    if (!headers) return test.skip();

    const res = await request.get('/api/mcp/clients', { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.clients)).toBe(true);
  });

  test('client items have expected fields', async ({ request }) => {
    const headers = validKeyHeaders();
    if (!headers) return test.skip();

    const res = await request.get('/api/mcp/clients', { headers });
    const body = await res.json();

    for (const client of body.clients) {
      expect(typeof client.id).toBe('string');
      expect(typeof client.email).toBe('string');
      expect(typeof client.status).toBe('string');
      expect(typeof client.instance_count).toBe('number');
      expect(Array.isArray(client.instances)).toBe(true);
    }
  });
});

// ── /api/mcp/components ────────────────────────────────────────────────────

test.describe('GET /api/mcp/components — authenticated', () => {
  test('returns components array', async ({ request }) => {
    const headers = validKeyHeaders();
    if (!headers) return test.skip();

    const res = await request.get('/api/mcp/components', { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.components)).toBe(true);
  });

  test('accepts optional instanceId query param', async ({ request }) => {
    const headers = validKeyHeaders();
    if (!headers) return test.skip();

    const res = await request.get('/api/mcp/components?instanceId=test-id', { headers });
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(Array.isArray(body.components)).toBe(true);
  });
});
