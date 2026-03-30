import { describe, it, expect, vi } from 'vitest';

// ─── Mock supabaseAdmin before importing the module ───────────────────────────

const { mockSupabase } = vi.hoisted(() => {
  const single = vi.fn();
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  const then = vi.fn().mockReturnValue(undefined);
  const eqUpdate = vi.fn().mockReturnValue({ then });
  const update = vi.fn().mockReturnValue({ eq: eqUpdate });
  const from = vi.fn().mockImplementation((table: string) => {
    if (table === 'api_key') return { select, update };
    return { select, update };
  });
  const mockSupabase = { from, _mocks: { single, eq, select, update, eqUpdate } };
  return { mockSupabase };
});

vi.mock('@/lib/supabaseAdmin', () => ({ supabaseAdmin: mockSupabase }));

import { validateApiKey } from '@/lib/apiKeyAuth';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): any {
  return {
    headers: {
      get: (name: string) => name === 'authorization' ? (authHeader ?? null) : null,
    },
  };
}

function mockLookup(userId: string | null) {
  mockSupabase._mocks.single.mockResolvedValue({
    data: userId ? { user_id: userId } : null,
    error: null,
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('validateApiKey', () => {
  it('returns null when Authorization header is absent', async () => {
    expect(await validateApiKey(makeRequest())).toBeNull();
  });

  it('returns null when header does not start with "Bearer fp_"', async () => {
    expect(await validateApiKey(makeRequest('Bearer sk_test_abc'))).toBeNull();
    expect(await validateApiKey(makeRequest('Basic abc'))).toBeNull();
    expect(await validateApiKey(makeRequest('fp_noBearerPrefix'))).toBeNull();
  });

  it('returns the user_id for a valid fp_ key found in the DB', async () => {
    mockLookup('user-abc');
    const result = await validateApiKey(makeRequest('Bearer fp_validkey123'));
    expect(result).toBe('user-abc');
  });

  it('returns null when the key hash is not found in the DB', async () => {
    mockLookup(null);
    expect(await validateApiKey(makeRequest('Bearer fp_unknownkey'))).toBeNull();
  });

  it('queries the api_key table with sha256 hash of the key', async () => {
    const { createHash } = await import('crypto');
    mockLookup('user-xyz');

    const apiKey = 'fp_testkey_abc';
    await validateApiKey(makeRequest(`Bearer ${apiKey}`));

    const expectedHash = createHash('sha256').update(apiKey).digest('hex');
    expect(mockSupabase._mocks.eq).toHaveBeenCalledWith('key_hash', expectedHash);
  });

  it('initiates a last_used_at update after a successful lookup (fire-and-forget)', async () => {
    mockLookup('user-def');
    await validateApiKey(makeRequest('Bearer fp_somekey'));
    // The update is called asynchronously — just check it was triggered
    expect(mockSupabase._mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ last_used_at: expect.any(String) })
    );
  });
});
