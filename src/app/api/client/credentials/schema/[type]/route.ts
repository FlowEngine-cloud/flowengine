/**
 * Credential Schema API
 * Proxies schema requests to the n8n instance
 * GET - Get the JSON schema for a specific credential type
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchN8nCredentialSchema, getCredentialDocUrl } from '@/lib/n8nInstanceApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Initialize Supabase client with service role

interface RouteParams {
  params: Promise<{ type: string }>;
}

/**
 * Get instance details and verify access
 */
async function getInstanceWithAccess(instanceId: string, userId: string) {
  let instance: any = null;

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

  // Verify user has access
  const isOwner = instance.user_id === userId;
  const { data: clientAccess } = await supabaseAdmin
    .from('client_instances')
    .select('id')
    .eq('instance_id', instanceId)
    .eq('user_id', userId)
    .maybeSingle();

  if (!isOwner && !clientAccess) {
    return { error: 'Access denied' };
  }

  if (!instance.n8n_api_key) {
    return { error: 'Instance API key not configured' };
  }

  if (!['active', 'trialing'].includes(instance.subscription_status)) {
    return { error: 'Instance subscription is not active' };
  }

  return { instance };
}

/**
 * GET /api/client/credentials/schema/[type]?instanceId=xxx
 * Get the JSON schema for a credential type
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { type: credentialType } = await params;

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

    if (!credentialType) {
      return NextResponse.json({ error: 'Credential type is required' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get instance and verify access
    const { instance, error: accessError } = await getInstanceWithAccess(instanceId, effectiveUserId);
    if (accessError || !instance) {
      return NextResponse.json({ error: accessError || 'Access denied' }, { status: 403 });
    }

    // Fetch schema from n8n
    const { schema, error: fetchError } = await fetchN8nCredentialSchema(
      instance.instance_url,
      instance.n8n_api_key,
      credentialType
    );

    if (fetchError) {
      console.error('[schema] Error fetching credential schema from n8n:', fetchError);
      return NextResponse.json({
        error: 'Failed to fetch credential schema',
        details: fetchError
      }, { status: 502 });
    }

    console.log('[schema] Fetched schema for', credentialType, ':', {
      hasSchema: !!schema,
      properties: schema?.properties ? Object.keys(schema.properties) : [],
      required: schema?.required || [],
    });

    return NextResponse.json({
      schema,
      credentialType,
      docUrl: getCredentialDocUrl(credentialType),
    });
  } catch (error) {
    console.error('Error in GET /api/client/credentials/schema/[type]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
