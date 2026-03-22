/**
 * Individual Credential API
 * DELETE - Delete a credential from the n8n instance
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteN8nCredential, disconnectCredentialFromWorkflows } from '@/lib/n8nInstanceApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Initialize Supabase client with service role

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Get instance details and verify access
 */
async function getInstanceWithAccess(instanceId: string, userId: string) {
  const { data: instance, error } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_url, n8n_api_key, user_id, invited_by_user_id, subscription_status')
    .eq('id', instanceId)
    .single();

  // If not found in pay-per-instance, check dedicated instances
  if (error || !instance) {
    const { data: dedicatedInstance } = await supabaseAdmin
      .from('n8n_instances')
      .select('id, instance_url, n8n_api_key, user_id')
      .eq('id', instanceId)
      .eq('user_id', userId)
      .neq('status', 'deleted')
      .single();

    if (dedicatedInstance) {
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
          subscription_status: 'active',
        }
      };
    }

    return { error: 'Instance not found' };
  }

  // Verify user has access (owner, agency manager, or invited client)
  const isOwner = instance.user_id === userId;
  const isManager = instance.invited_by_user_id === userId;
  const { data: clientAccess } = await supabaseAdmin
    .from('client_instances')
    .select('id')
    .eq('instance_id', instanceId)
    .eq('user_id', userId)
    .single();

  if (!isOwner && !isManager && !clientAccess) {
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
 * DELETE /api/client/credentials/[id]?instanceId=xxx
 * Delete a credential from the n8n instance
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id: credentialId } = await params;

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

    if (!credentialId) {
      return NextResponse.json({ error: 'Credential ID is required' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get instance and verify access
    const { instance, error: accessError } = await getInstanceWithAccess(instanceId, effectiveUserId);
    if (accessError || !instance) {
      return NextResponse.json({ error: accessError || 'Access denied' }, { status: 403 });
    }

    // Get credential type from query param or local records (n8n returns 405 for GET /credentials/{id})
    const credentialType = searchParams.get('type');

    // Try to get type from local records if not provided
    let typeToDisconnect = credentialType;
    if (!typeToDisconnect) {
      const { data: localRecord } = await supabaseAdmin
        .from('credential_records')
        .select('type')
        .eq('instance_id', instanceId)
        .eq('n8n_credential_id', credentialId)
        .single();
      typeToDisconnect = localRecord?.type;
    }

    // Disconnect the credential from all workflows that use it
    if (typeToDisconnect) {
      try {
        const { disconnectedWorkflows, errors: disconnectErrors } = await disconnectCredentialFromWorkflows(
          instance.instance_url,
          instance.n8n_api_key,
          credentialId,
          typeToDisconnect
        );
        console.log(`[DELETE Credential] Disconnected from ${disconnectedWorkflows} workflow(s)`, disconnectErrors.length > 0 ? { errors: disconnectErrors } : '');
      } catch (disconnectError) {
        // Log but don't fail - we still want to delete the credential
        console.warn('[DELETE Credential] Failed to disconnect from workflows:', disconnectError);
      }
    } else {
      console.log('[DELETE Credential] No credential type available, skipping workflow disconnect');
    }

    // Delete credential from n8n
    const { success, error: deleteError } = await deleteN8nCredential(
      instance.instance_url,
      instance.n8n_api_key,
      credentialId
    );

    if (!success) {
      // Treat 404 as success - credential already deleted
      const errorStr = String(deleteError || '');
      const is404 = errorStr.includes('404') || errorStr.includes('Not Found');
      console.log('[DELETE Credential] Delete result:', { success, deleteError, errorStr, is404 });

      if (is404) {
        console.log('[DELETE Credential] Credential already deleted from n8n (404)');
      } else {
        console.error('Error deleting credential from n8n:', deleteError);
        return NextResponse.json({
          error: deleteError || 'Failed to delete credential from n8n'
        }, { status: 502 });
      }
    }

    // Clean up local record if exists
    try {
      await supabaseAdmin
        .from('credential_records')
        .delete()
        .eq('instance_id', instanceId)
        .eq('n8n_credential_id', credentialId);
    } catch (recordError) {
      // Non-fatal - credential was deleted from n8n
      console.warn('Failed to delete local credential record:', recordError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/client/credentials/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
