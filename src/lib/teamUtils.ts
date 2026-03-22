import { SupabaseClient } from '@supabase/supabase-js';

export type TeamRole = 'owner' | 'admin' | 'manager' | 'member';

export interface TeamContext {
  ownerId: string;
  isTeamMember: boolean;
  role: TeamRole;
}

/**
 * Get the effective owner ID for a user.
 * If the user is a team member, returns the owner's ID and their role.
 * If not, returns their own ID with role 'owner'.
 *
 * Use this in API routes (service-role client bypasses RLS).
 */
export async function getEffectiveOwnerId(
  supabase: SupabaseClient,
  userId: string
): Promise<TeamContext> {
  const { data } = await supabase
    .from('team_members')
    .select('owner_id, role')
    .eq('member_id', userId)
    .eq('status', 'accepted')
    .limit(1)
    .maybeSingle();

  if (data?.owner_id) {
    return { ownerId: data.owner_id, isTeamMember: true, role: data.role as TeamRole };
  }
  return { ownerId: userId, isTeamMember: false, role: 'owner' };
}

/** Check if role can perform write operations (deploy, delete, invite clients) */
export function canWrite(role: TeamRole): boolean {
  return role !== 'member';
}

/** Check if role can view/manage billing and payments */
export function canManageBilling(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}

/** Check if role can manage team members (invite/remove) */
export function canManageTeam(role: TeamRole): boolean {
  return role === 'owner' || role === 'admin';
}
