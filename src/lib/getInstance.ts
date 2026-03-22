import { createClient } from '@supabase/supabase-js';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

/**
 * Helper function to get an n8n instance by ID with server details
 *
 * ARCHITECTURE:
 * - Instances store ONLY server_ip
 * - All server configuration (domain, SSH, service IDs) comes from deployment_servers table
 * - This function automatically joins and returns combined data
 * - Team members are resolved to team owner automatically
 *
 * @param instanceId - The UUID of the instance
 * @param userId - The user ID (for security check) — team members are resolved to owner
 * @returns The instance object with server details merged in, or null if not found
 */
export async function getInstance(instanceId: string, userId: string) {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Resolve team member → owner ID
  const effectiveUserId = await resolveEffectiveUserId(supabase, userId);

  // First, try n8n_instances (Pro/Pro+ membership instances)
  const { data: membershipInstance, error: membershipError } = await supabase
    .from('n8n_instances')
    .select('*')
    .eq('id', instanceId)
    .eq('user_id', effectiveUserId)
    .is('deleted_at', null)
    .maybeSingle();

  if (membershipError) {
    console.error('Error fetching membership instance:', membershipError);
  }

  if (membershipInstance) {
    const enriched = await enrichInstanceWithServerDetails(supabase, membershipInstance);
    enriched._source_table = 'n8n_instances';
    return enriched;
  }

  // Try pay_per_instance_deployments (instance add-ons AND new membership instances)
  // Check both owner (user_id) and agency manager (invited_by_user_id)
  const { data: payPerInstance, error: payPerError } = await supabase
    .from('pay_per_instance_deployments')
    .select('*')
    .eq('id', instanceId)
    .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
    .is('deleted_at', null)
    .maybeSingle();

  if (payPerError) {
    console.error('Error fetching pay-per-instance:', payPerError);
  }

  if (payPerInstance) {
    const enriched = await enrichInstanceWithServerDetails(supabase, payPerInstance);
    enriched._source_table = 'pay_per_instance_deployments';
    return enriched;
  }

  return null;
}

/**
 * Enriches instance data with server details from deployment_servers table
 *
 * @param supabase - Supabase client
 * @param instance - Instance record (with server_ip)
 * @returns Instance with server details merged in
 */
async function enrichInstanceWithServerDetails(supabase: any, instance: any) {
  if (!instance.server_ip) {
    // No server_ip - return instance as-is (legacy or incomplete)
    return instance;
  }

  // Fetch server details from deployment_servers
  const { data: server, error: serverError } = await supabase
    .from('deployment_servers')
    .select('*')
    .eq('server_ip', instance.server_ip)
    .maybeSingle();

  if (serverError) {
    console.error('Error fetching server details:', serverError);
    return instance; // Return instance without server enrichment
  }

  if (!server) {
    console.warn(`Server not found for IP: ${instance.server_ip}`);
    return instance; // Return instance without server enrichment
  }

  // Merge server details into instance
  // Use server_ prefix to avoid naming conflicts with instance fields
  return {
    ...instance,
    server_domain: server.domain,
    server_ssh_port: server.ssh_port,
    server_ssh_user: server.ssh_user,
    coolify_server_id: server.coolify_server_id,
    coolify_project_id: server.coolify_project_id,
    coolify_environment_id: server.coolify_environment_id,
    server_name: server.name,
  };
}

/**
 * Helper function to update an instance in the correct table
 *
 * @param instanceId - The UUID of the instance
 * @param userId - The user ID (for security check)
 * @param updates - The fields to update
 * @returns Success boolean and error if any
 */
export async function updateInstance(
  instanceId: string,
  userId: string,
  updates: Record<string, any>
) {
  const supabase = createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Try to find which table the instance is in
  const instance = await getInstance(instanceId, userId);

  if (!instance) {
    return { success: false, error: 'Instance not found' };
  }

  // Resolve team member → owner ID
  const effectiveUserId = await resolveEffectiveUserId(supabase, userId);

  // Use _source_table set by getInstance() to route to the correct table
  const tableName = instance._source_table || 'n8n_instances';
  const isPpi = tableName === 'pay_per_instance_deployments';

  // For PPI instances, allow both owner and agency manager to update
  const { error } = await supabase
    .from(tableName)
    .update(updates)
    .eq('id', instanceId)
    .or(isPpi ? `user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}` : `user_id.eq.${effectiveUserId}`);

  if (error) {
    return { success: false, error: error.message };
  }

  return { success: true, error: null };
}
