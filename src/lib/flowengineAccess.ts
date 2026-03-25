import { SupabaseClient } from '@supabase/supabase-js';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

/**
 * Verifies that a portal user has access to manage FlowEngine instances.
 *
 * Access is granted to:
 * - Portal owners (have records in pay_per_instance_deployments as user_id)
 * - Agency managers (have records as invited_by_user_id)
 * - Team members acting on behalf of an owner (resolved via resolveEffectiveUserId)
 *
 * Access is DENIED to:
 * - Pure clients (only in client_instances, no ownership records)
 *
 * Returns { authorized, effectiveUserId } — effectiveUserId is the resolved owner ID.
 */
export async function verifyFlowEngineAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<{ authorized: boolean; effectiveUserId: string }> {
  const effectiveUserId = await resolveEffectiveUserId(supabase, userId);

  // Team members resolved to a different owner — always authorized as managers
  if (effectiveUserId !== userId) {
    return { authorized: true, effectiveUserId };
  }

  // For everyone else: check if they own or manage at least one instance
  const { data } = await supabase
    .from('pay_per_instance_deployments')
    .select('id')
    .or(`user_id.eq.${userId},invited_by_user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();

  return { authorized: !!data, effectiveUserId };
}
