/**
 * Client Execution Detail API
 * GET /api/client/executions/[id]?instanceId=xxx
 * Fetch detailed execution data including output from n8n
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchN8nExecutionDetail } from '@/lib/n8nInstanceApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Initialize Supabase client with service role

/**
 * Check if user is a client of the instance's agency
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: executionId } = await params;
  const { searchParams } = new URL(request.url);
  const instanceId = searchParams.get('instanceId');

  if (!instanceId) {
    return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
  }

  // Get user from auth header
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.split(' ')[1];
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Resolve team access
  const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

  // Fetch instance details
  const { data: instance, error: instanceError } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_url, n8n_api_key, user_id, invited_by_user_id')
    .eq('id', instanceId)
    .single();

  if (instanceError || !instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  // Verify instance has API key
  if (!instance.n8n_api_key) {
    return NextResponse.json({ error: 'Instance API key not configured' }, { status: 400 });
  }

  // Check ownership - user owns the instance, is the agency manager, or is a client
  const isOwner = instance.user_id === effectiveUserId;
  const isManager = instance.invited_by_user_id === effectiveUserId;
  const isClient = await checkIfUserIsClient(instanceId, user.id);

  if (!isOwner && !isManager && !isClient) {
    return NextResponse.json({ error: 'Access denied' }, { status: 403 });
  }

  // Fetch execution details from n8n
  const result = await fetchN8nExecutionDetail(
    instance.instance_url,
    instance.n8n_api_key,
    executionId
  );

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || 'Failed to fetch execution details' },
      { status: 500 }
    );
  }

  return NextResponse.json({ execution: result.execution });
}
