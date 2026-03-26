import { SupabaseClient } from '@supabase/supabase-js';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

/**
 * Verifies that a portal user has access to manage FlowEngine instances.
 *
 * Access is granted to:
 * - Portal owners (have records in pay_per_instance_deployments as user_id)
 * - Agency managers (have records as invited_by_user_id)
 * - Team members acting on behalf of an owner (resolved via resolveEffectiveUserId)
 * - Fresh portal owners with no local instances (instances live only in FlowEngine's DB)
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

  // Check if they own or manage at least one instance
  const { data: ownerRecord } = await supabase
    .from('pay_per_instance_deployments')
    .select('id')
    .or(`user_id.eq.${userId},invited_by_user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();

  if (ownerRecord) {
    return { authorized: true, effectiveUserId };
  }

  // No local instances — could be a fresh portal owner whose instances live only in
  // FlowEngine's DB. Only deny access to pure clients (users who exist solely in
  // client_instances with no ownership records).
  const { data: clientRecord } = await supabase
    .from('client_instances')
    .select('instance_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle();

  return { authorized: !clientRecord, effectiveUserId };
}
