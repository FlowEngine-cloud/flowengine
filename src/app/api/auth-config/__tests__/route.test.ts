import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({ from: mockFrom })),
}));

import { GET } from '../route';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build chained mock for:
 *   .from('portal_settings').select(...).limit(1).single()  → resolves { data }
 *   .from('profiles').select(...).or(...).limit(1).maybeSingle() → resolves { data }
 *   .from('profiles').select('id', { count: 'exact', head: true }) → resolves { count }
 */
function mockThreeQueries(
  settings: Record<string, any> | null,
  profile: { business_name: string } | null,
  profileCount: number
) {
  let call = 0;
  mockFrom.mockImplementation(() => {
    call++;
    if (call === 1) {
      // portal_settings query: .select().limit(1).single()
      const single = vi.fn().mockResolvedValue({ data: settings });
      const limit = vi.fn().mockReturnValue({ single });
      const select = vi.fn().mockReturnValue({ limit });
      return { select };
    }
    if (call === 2) {
      // profiles query for business_name: .select().or().limit(1).maybeSingle()
      const maybeSingle = vi.fn().mockResolvedValue({ data: profile });
      const limit = vi.fn().mockReturnValue({ maybeSingle });
      const or = vi.fn().mockReturnValue({ limit });
      const select = vi.fn().mockReturnValue({ or });
      return { select };
    }
    // profiles count query: .select('id', { count: 'exact', head: true })
    const select = vi.fn().mockResolvedValue({ count: profileCount });
    return { select };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/auth-config', () => {
  it('returns settings from DB when data is available', async () => {
    mockThreeQueries(
      { allow_signup: true, enable_google_auth: true, enable_linkedin_auth: false, enable_github_auth: true },
      { business_name: 'Acme Corp' },
      5
    );

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.allow_signup).toBe(true);
    expect(body.enable_google_auth).toBe(true);
    expect(body.enable_linkedin_auth).toBe(false);
    expect(body.enable_github_auth).toBe(true);
    expect(body.agency_name).toBe('Acme Corp');
    expect(body.first_run).toBe(false);
  });

  it('sets first_run: true and allow_signup: true when no profiles exist', async () => {
    mockThreeQueries(
      { allow_signup: false, enable_google_auth: false, enable_linkedin_auth: false, enable_github_auth: false },
      null,
      0
    );

    const res = await GET();
    const body = await res.json();

    expect(body.first_run).toBe(true);
    expect(body.allow_signup).toBe(true); // first run overrides DB setting
    expect(body.agency_name).toBeNull();
  });

  it('defaults booleans to false when settings row is null', async () => {
    mockThreeQueries(null, null, 3);

    const res = await GET();
    const body = await res.json();

    expect(body.allow_signup).toBe(false);
    expect(body.enable_google_auth).toBe(false);
    expect(body.enable_linkedin_auth).toBe(false);
    expect(body.enable_github_auth).toBe(false);
  });

  it('returns safe defaults when an exception is thrown', async () => {
    mockFrom.mockImplementation(() => {
      throw new Error('DB connection failed');
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.allow_signup).toBe(false);
    expect(body.enable_google_auth).toBe(false);
    expect(body.enable_linkedin_auth).toBe(false);
    expect(body.enable_github_auth).toBe(false);
    expect(body.agency_name).toBeNull();
    expect(body.first_run).toBe(false);
  });

  it('returns agency_name as null when profile query returns null', async () => {
    mockThreeQueries(
      { allow_signup: true, enable_google_auth: false, enable_linkedin_auth: false, enable_github_auth: false },
      null,
      2
    );

    const res = await GET();
    const body = await res.json();

    expect(body.agency_name).toBeNull();
  });
});
