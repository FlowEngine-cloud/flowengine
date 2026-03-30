import { describe, it, expect, vi } from 'vitest';
import {
  canWrite,
  canManageBilling,
  canManageTeam,
  getEffectiveOwnerId,
  type TeamRole,
} from '@/lib/teamUtils';

// ─── canWrite ─────────────────────────────────────────────────────────────────

describe('canWrite', () => {
  it('returns true for owner', () => expect(canWrite('owner')).toBe(true));
  it('returns true for admin', () => expect(canWrite('admin')).toBe(true));
  it('returns true for manager', () => expect(canWrite('manager')).toBe(true));
  it('returns false for member', () => expect(canWrite('member')).toBe(false));
});

// ─── canManageBilling ─────────────────────────────────────────────────────────

describe('canManageBilling', () => {
  it('returns true for owner', () => expect(canManageBilling('owner')).toBe(true));
  it('returns true for admin', () => expect(canManageBilling('admin')).toBe(true));
  it('returns false for manager', () => expect(canManageBilling('manager')).toBe(false));
  it('returns false for member', () => expect(canManageBilling('member')).toBe(false));
});

// ─── canManageTeam ────────────────────────────────────────────────────────────

describe('canManageTeam', () => {
  it('returns true for owner', () => expect(canManageTeam('owner')).toBe(true));
  it('returns true for admin', () => expect(canManageTeam('admin')).toBe(true));
  it('returns true for manager', () => expect(canManageTeam('manager')).toBe(true));
  it('returns false for member', () => expect(canManageTeam('member')).toBe(false));
});

// ─── permission matrix exhaustive check ──────────────────────────────────────

describe('permission matrix', () => {
  const roles: TeamRole[] = ['owner', 'admin', 'manager', 'member'];

  it('only member cannot write', () => {
    const canWriteRoles = roles.filter(r => canWrite(r));
    expect(canWriteRoles).toEqual(['owner', 'admin', 'manager']);
  });

  it('only owner and admin can manage billing', () => {
    const billingRoles = roles.filter(r => canManageBilling(r));
    expect(billingRoles).toEqual(['owner', 'admin']);
  });

  it('only owner, admin, and manager can manage team', () => {
    const teamRoles = roles.filter(r => canManageTeam(r));
    expect(teamRoles).toEqual(['owner', 'admin', 'manager']);
  });
});

// ─── getEffectiveOwnerId ──────────────────────────────────────────────────────

describe('getEffectiveOwnerId', () => {
  function makeMockSupabase(response: { data: { owner_id: string; role: string } | null }) {
    // Build a chainable mock that returns the given response on .maybeSingle()
    const maybeSingle = vi.fn().mockResolvedValue(response);
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const eq2 = vi.fn().mockReturnValue({ limit });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    return { from } as any;
  }

  it('returns own userId and role "owner" when user is not a team member', async () => {
    const supabase = makeMockSupabase({ data: null });
    const result = await getEffectiveOwnerId(supabase, 'user-abc');
    expect(result).toEqual({ ownerId: 'user-abc', isTeamMember: false, role: 'owner' });
  });

  it('returns owner_id and member role when user is a team member', async () => {
    const supabase = makeMockSupabase({ data: { owner_id: 'owner-xyz', role: 'admin' } });
    const result = await getEffectiveOwnerId(supabase, 'member-user');
    expect(result).toEqual({ ownerId: 'owner-xyz', isTeamMember: true, role: 'admin' });
  });

  it('queries the team_members table', async () => {
    const supabase = makeMockSupabase({ data: null });
    await getEffectiveOwnerId(supabase, 'user-123');
    expect(supabase.from).toHaveBeenCalledWith('team_members');
  });

  it('filters by member_id and accepted status', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null });
    const limit = vi.fn().mockReturnValue({ maybeSingle });
    const eq2 = vi.fn().mockReturnValue({ limit });
    const eq1 = vi.fn().mockReturnValue({ eq: eq2 });
    const select = vi.fn().mockReturnValue({ eq: eq1 });
    const from = vi.fn().mockReturnValue({ select });
    const supabase = { from } as any;

    await getEffectiveOwnerId(supabase, 'test-member');

    expect(eq1).toHaveBeenCalledWith('member_id', 'test-member');
    expect(eq2).toHaveBeenCalledWith('status', 'accepted');
  });

  it('handles different team roles correctly', async () => {
    const roles: TeamRole[] = ['admin', 'manager', 'member'];
    for (const role of roles) {
      const supabase = makeMockSupabase({ data: { owner_id: 'owner-id', role } });
      const result = await getEffectiveOwnerId(supabase, 'member-user');
      expect(result.role).toBe(role);
      expect(result.isTeamMember).toBe(true);
    }
  });
});
