import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Resolves the effective user ID for API access checks.
 * Team members act on behalf of the team owner.
 * Returns the owner's ID if the user is a team member, otherwise returns the user's own ID.
 *
 * Uses a direct table query (not RPC) so it works with service role clients
 * that don't have auth.uid() context.
 */
export async function resolveEffectiveUserId(supabase: SupabaseClient, userId: string): Promise<string> {
  try {
    const { data: membership } = await supabase
      .from('team_members')
      .select('owner_id')
      .eq('member_id', userId)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();

    if (membership?.owner_id) {
      return membership.owner_id;
    }
  } catch {
    // Fall back to user's own ID
  }
  return userId;
}
