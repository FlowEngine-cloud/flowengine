import { describe, it, expect, vi } from 'vitest';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

// ─── resolveEffectiveUserId ───────────────────────────────────────────────────

describe('resolveEffectiveUserId', () => {
  function makeSupabase(membership: { owner_id: string } | null) {
    const maybeSingle = vi.fn().mockResolvedValue({ data: membership });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const eq2 = vi.fn().mockReturnValue({ limit });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    return { from } as any;
  }

  it('returns the owner_id when user is a team member', async () => {
    const supabase = makeSupabase({ owner_id: 'owner-abc' });
    const result = await resolveEffectiveUserId(supabase, 'member-xyz');
    expect(result).toBe('owner-abc');
  });

  it("returns the user's own ID when not a team member", async () => {
    const supabase = makeSupabase(null);
    const result = await resolveEffectiveUserId(supabase, 'user-123');
    expect(result).toBe('user-123');
  });

  it("returns the user's own ID when DB query throws", async () => {
    const from = vi.fn().mockImplementation(() => { throw new Error('DB error'); });
    const result = await resolveEffectiveUserId({ from } as any, 'user-999');
    expect(result).toBe('user-999');
  });

  it("returns the user's own ID when owner_id is empty string", async () => {
    const supabase = makeSupabase({ owner_id: '' });
    const result = await resolveEffectiveUserId(supabase, 'user-123');
    expect(result).toBe('user-123');
  });
});
