/**
 * Client Credential Types API
 * GET - Fetch all available credential types from the client's n8n instance
 * Falls back to built-in list if n8n API is unavailable
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchN8nCredentialTypes, getCredentialDocUrl } from '@/lib/n8nInstanceApi';
import { CREDENTIAL_MAPPINGS } from '@/lib/n8n/credentialExtractor';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Initialize Supabase client with service role

/**
 * Get instance details and verify access
 */
async function getInstanceWithAccess(instanceId: string, userId: string) {
  let instance: any = null;

  // Check pay-per-instance deployments first
  const { data: payPerInstance } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_url, n8n_api_key, user_id, invited_by_user_id, subscription_status')
    .eq('id', instanceId)
    .maybeSingle();

  if (payPerInstance) {
    instance = payPerInstance;
  } else {
    // Fallback: dedicated instance (n8n_instances table)
    const { data: dedicatedInstance } = await supabaseAdmin
      .from('n8n_instances')
      .select('id, instance_url, n8n_api_key, user_id')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .maybeSingle();

    if (dedicatedInstance) {
      instance = { ...dedicatedInstance, subscription_status: 'active' };
    }
  }

  if (!instance) {
    return { error: 'Instance not found' };
  }

  // Verify user has access (either owner or invited client)
  const isOwner = instance.user_id === userId;
  const isClient = await checkIfUserIsClient(instanceId, userId);

  if (!isOwner && !isClient) {
    return { error: 'Access denied' };
  }

  // Verify instance has API key
  if (!instance.n8n_api_key) {
    return { error: 'Instance API key not configured' };
  }

  // Verify subscription is active
  if (!['active', 'trialing'].includes(instance.subscription_status)) {
    return { error: 'Instance subscription is not active' };
  }

  return { instance };
}

/**
 * Check if user is a client of the instance
 */
async function checkIfUserIsClient(instanceId: string, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('client_instances')
    .select('id')
    .eq('instance_id', instanceId)
    .eq('user_id', userId)
    .single();

  return !!data;
}

/**
 * GET /api/client/credentials/types?instanceId=xxx
 * List all available credential types from the n8n instance
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify user session
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get instance ID from query params
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get instance and verify access
    const { instance, error: accessError } = await getInstanceWithAccess(instanceId, effectiveUserId);
    if (accessError || !instance) {
      return NextResponse.json({ error: accessError || 'Access denied' }, { status: 403 });
    }

    // Fetch credential types from n8n
    const { credentialTypes, error: fetchError } = await fetchN8nCredentialTypes(
      instance.instance_url,
      instance.n8n_api_key
    );

    // Custom FlowEngine-specific credentials that should always be available
    const customFlowEngineCredentials = [
      {
        name: 'flowEngineApi',
        displayName: 'FlowEngine LLM',
        icon: 'bot',
        documentationUrl: getCredentialDocUrl('flowEngineApi'),
      },
    ];

    // If there's a fetch error, use built-in fallback list
    if (fetchError || !credentialTypes || credentialTypes.length === 0) {
      console.warn('Could not fetch credential types from n8n, using fallback list:', fetchError);

      // Build fallback list from CREDENTIAL_MAPPINGS
      const fallbackTypes = Object.entries(CREDENTIAL_MAPPINGS).map(([keyword, mapping]: [string, { type: string; name: string; icon: string }]) => ({
        name: mapping.type,
        displayName: mapping.name,
        icon: mapping.icon,
        documentationUrl: getCredentialDocUrl(mapping.type),
      }));

      // Add FlowEngine LLM to fallback list
      const allFallbackTypes = [...fallbackTypes, ...customFlowEngineCredentials];

      // Remove duplicates
      const uniqueFallbackTypes = allFallbackTypes.filter((type, index, self) =>
        index === self.findIndex(t => t.name === type.name)
      );

      // Sort by display name for better UX
      uniqueFallbackTypes.sort((a, b) => a.displayName.localeCompare(b.displayName));

      return NextResponse.json({
        credentialTypes: uniqueFallbackTypes,
        warning: 'Using built-in credential list. Some credential types may not be available.',
      });
    }

    // Merge n8n types with custom FlowEngine credentials
    const allTypes = [...credentialTypes, ...customFlowEngineCredentials];

    // Remove duplicates (in case flowEngineApi somehow exists in n8n)
    const uniqueTypes = allTypes.filter((type, index, self) =>
      index === self.findIndex(t => t.name === type.name)
    );

    return NextResponse.json({ credentialTypes: uniqueTypes });
  } catch (error) {
    console.error('Error in GET /api/client/credentials/types:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
