/**
 * Client Credentials API
 * Proxies credential operations to the client's n8n instance
 * GET - List all credentials
 * POST - Create a new credential
 */

import { NextRequest, NextResponse } from 'next/server';
import { createN8nCredential, getCredentialDocUrl, extractCredentialsFromWorkflows, connectCredentialToWorkflows } from '@/lib/n8nInstanceApi';
import { normalizeCredentialData, logNormalization } from '@/lib/credentialNormalization';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Initialize Supabase client with service role

/**
 * Get instance details and verify access
 */
async function getInstanceWithAccess(instanceId: string, userId: string) {
  // Check pay-per-instance deployments first
  const { data: instance, error } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_url, n8n_api_key, user_id, invited_by_user_id, subscription_status, is_external')
    .eq('id', instanceId)
    .single();

  // If not found, check dedicated instances (n8n_instances table)
  if (error || !instance) {
    const { data: dedicatedInstance } = await supabaseAdmin
      .from('n8n_instances')
      .select('id, instance_url, n8n_api_key, user_id')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (dedicatedInstance) {
      // Dedicated instance found - user is owner
      if (!dedicatedInstance.n8n_api_key) {
        return { error: 'Instance API key not configured' };
      }
      return {
        instance: {
          id: dedicatedInstance.id,
          instance_url: dedicatedInstance.instance_url,
          n8n_api_key: dedicatedInstance.n8n_api_key,
          user_id: dedicatedInstance.user_id,
          invited_by_user_id: null,
          subscription_status: 'active', // Dedicated instances are always active
        }
      };
    }

    return { error: 'Instance not found' };
  }

  // Verify user has access (owner, agency manager, or invited client)
  const isOwner = instance.user_id === userId;
  const isManager = instance.invited_by_user_id === userId;
  const isClient = await checkIfUserIsClient(instanceId, userId);

  if (!isOwner && !isManager && !isClient) {
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
 * GET /api/client/credentials?instanceId=xxx
 * List credentials connected to workflows (extracted from workflow nodes)
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

    // External/demo instance — return mock credentials without hitting real n8n
    if ((instance as any).is_external) {
      return NextResponse.json({
        credentials: [
          { id: 'cred-1', name: 'OpenAI Account',   type: 'openAiApi'           },
          { id: 'cred-2', name: 'Google OAuth',      type: 'googleOAuth2'        },
          { id: 'cred-3', name: 'Slack Workspace',   type: 'slackOAuth2'         },
          { id: 'cred-4', name: 'HubSpot CRM',       type: 'hubspotOAuth2'       },
          { id: 'cred-5', name: 'Google Sheets',     type: 'googleSheetsOAuth2'  },
          { id: 'cred-6', name: 'FlowEngine AI',     type: 'CUSTOM.flowEngineLlm' },
        ],
        missing: [],
      });
    }

    // Extract credentials from workflows - this is our source of truth
    // We only show credentials that are actually connected to workflow nodes
    // Note: n8n's public API doesn't support listing/reading credentials (returns 405)
    const { credentials: connected, required, error: extractError } = await extractCredentialsFromWorkflows(
      instance.instance_url,
      instance.n8n_api_key
    );

    if (extractError) {
      console.error('[credentials] Failed to extract credentials from workflows:', extractError);
    }

    console.log('[credentials] Extracted from workflows:', {
      connectedCount: connected.length,
      connectedIds: connected.map(c => c.id),
      requiredTypes: required.map(r => r.type),
    });

    // Only show credentials extracted from workflow nodes
    // Don't merge with local credential_records - those can be stale
    // Local records are only used for auto-connect purposes, not display
    const credentialsWithDocs = connected.map(cred => ({
      ...cred,
      docUrl: getCredentialDocUrl(cred.type),
    }));

    // Calculate missing credentials: required types that aren't connected
    const connectedTypes = new Set(connected.map(c => c.type));
    let missing = required
      .filter(r => !connectedTypes.has(r.type))
      .map(r => ({
        type: r.type,
        name: r.name,
        workflows: r.workflows,
        docUrl: getCredentialDocUrl(r.type),
      }));

    // Try to auto-connect unlinked credentials using local records
    // (since n8n API can't list credentials, we keep local records for auto-connect only)
    if (missing.length > 0) {
      const missingTypes = missing.map(m => m.type);

      // Query local credential_records for missing types
      const { data: localCredsForMissing } = await supabaseAdmin
        .from('credential_records')
        .select('n8n_credential_id, type, name')
        .eq('instance_id', instanceId)
        .in('type', missingTypes);

      console.log('[credentials] Found local credential records for missing types:',
        localCredsForMissing?.length || 0,
        localCredsForMissing?.map(c => ({ type: c.type, name: c.name })) || []
      );

      let anyConnected = false;
      if (localCredsForMissing && localCredsForMissing.length > 0) {
        for (const cred of localCredsForMissing) {
          try {
            // Try to connect - if credential was deleted in n8n, workflow update will fail
            const result = await connectCredentialToWorkflows(
              instance.instance_url,
              instance.n8n_api_key,
              cred.n8n_credential_id,
              cred.name,
              cred.type
            );
            if (result.connectedWorkflows > 0) {
              console.log(`[credentials] Auto-connected ${cred.type} to ${result.connectedWorkflows} workflow(s)`);
              anyConnected = true;
            }
          } catch (e) {
            console.warn(`[credentials] Failed to auto-connect ${cred.type}:`, e);
          }
        }
      }

      if (anyConnected) {
        // Re-fetch to get updated state
        const { credentials: updatedConnected, required: updatedRequired } = await extractCredentialsFromWorkflows(
          instance.instance_url,
          instance.n8n_api_key
        );

        const updatedConnectedTypes = new Set(updatedConnected.map(c => c.type));
        missing = updatedRequired
          .filter(r => !updatedConnectedTypes.has(r.type))
          .map(r => ({
            type: r.type,
            name: r.name,
            workflows: r.workflows,
            docUrl: getCredentialDocUrl(r.type),
          }));

        // Update credentialsWithDocs with new data
        credentialsWithDocs.length = 0;
        credentialsWithDocs.push(...updatedConnected.map(cred => ({
          ...cred,
          docUrl: getCredentialDocUrl(cred.type),
        })));
      }
    }

    console.log('[credentials] Response:', {
      connected: credentialsWithDocs.length,
      connectedTypes: Array.from(connectedTypes),
      required: required.length,
      requiredTypes: required.map(r => r.type),
      missing: missing.length,
      missingTypes: missing.map(m => m.type),
    });

    return NextResponse.json({
      credentials: credentialsWithDocs,
      missing: missing,
    });
  } catch (error) {
    console.error('Error in GET /api/client/credentials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/client/credentials
 * Create a new credential in the n8n instance
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { instanceId, type, name, data } = body;

    // Validate required fields
    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    if (!type || typeof type !== 'string') {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }

    if (!data || typeof data !== 'object') {
      return NextResponse.json({ error: 'data is required' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get instance and verify access
    const { instance, error: accessError } = await getInstanceWithAccess(instanceId, effectiveUserId);
    if (accessError || !instance) {
      return NextResponse.json({ error: accessError || 'Access denied' }, { status: 403 });
    }

    // Fetch schema to normalize data with proper defaults
    const { fetchN8nCredentialSchema } = await import('@/lib/n8nInstanceApi');
    const { schema } = await fetchN8nCredentialSchema(
      instance.instance_url,
      instance.n8n_api_key,
      type
    );

    // Normalize credential data based on schema
    // This handles conditional required fields (allOf, oneOf validation in JSON Schema)
    const normalizedData = normalizeCredentialData(data, schema);

    // Log what normalization happened
    logNormalization(data, normalizedData, type);

    // Log what we're sending to n8n for debugging
    console.log('[credentials/create] Creating credential in n8n:', {
      type,
      name,
      dataKeys: Object.keys(normalizedData),
      dataPreview: Object.fromEntries(
        Object.entries(normalizedData).map(([k, v]) => [
          k,
          typeof v === 'string' && v.length > 20 ? `${v.substring(0, 20)}...` : v
        ])
      )
    });

    // Create credential in n8n
    const { credential, error: createError } = await createN8nCredential(
      instance.instance_url,
      instance.n8n_api_key,
      { type, name, data: normalizedData }
    );

    if (createError || !credential) {
      console.error('[credentials/create] Error creating credential in n8n:', createError);
      return NextResponse.json({
        error: createError || 'Failed to create credential in n8n',
        details: 'Check that the credential data matches the required schema'
      }, { status: 502 });
    }

    // Store local record for template import matching
    // This allows templates to find newly created credentials before they're connected to workflows
    try {
      await supabaseAdmin
        .from('credential_records')
        .upsert({
          instance_id: instanceId,
          n8n_credential_id: credential.id,
          type: credential.type,
          name: credential.name,
          created_by: user.id,
        }, {
          onConflict: 'instance_id,n8n_credential_id',
        });
    } catch (recordError) {
      // Non-fatal - credential was created in n8n, local record is just for convenience
      console.warn('Failed to store local credential record:', recordError);
    }

    // Auto-connect credential to workflow nodes that need it
    let connectionResult = { connectedWorkflows: 0, errors: [] as string[] };
    try {
      connectionResult = await connectCredentialToWorkflows(
        instance.instance_url,
        instance.n8n_api_key,
        credential.id,
        credential.name,
        credential.type
      );
      console.log(`[credentials] Auto-connected to ${connectionResult.connectedWorkflows} workflow(s)`);
    } catch (connectError) {
      // Non-fatal - credential was created, just couldn't auto-connect
      console.warn('Failed to auto-connect credential to workflows:', connectError);
    }

    return NextResponse.json({
      credential: {
        ...credential,
        docUrl: getCredentialDocUrl(credential.type),
      },
      connectedWorkflows: connectionResult.connectedWorkflows,
      connectionErrors: connectionResult.errors.length > 0 ? connectionResult.errors : undefined,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/client/credentials:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
