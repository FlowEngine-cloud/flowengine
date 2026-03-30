import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { toggleN8nWorkflow } from '@/lib/n8nInstanceApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Toggle workflow active status for client panel
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string; workflowId: string }> }
) {
  try {
    const { instanceId, workflowId } = await params;

    // Validate UUID format for instanceId
    if (!isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Invalid instance ID format' }, { status: 400 });
    }

    // Validate workflowId format (n8n uses numeric strings or UUIDs)
    if (!workflowId || typeof workflowId !== 'string' || workflowId.length > 100 || !/^[a-zA-Z0-9-_]+$/.test(workflowId)) {
      return NextResponse.json({ error: 'Invalid workflow ID format' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { active } = body;

    // Validate active parameter
    if (typeof active !== 'boolean') {
      return NextResponse.json({ error: 'Invalid active parameter: must be a boolean' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Check if user owns this instance OR is agency manager via invited_by_user_id
    let instanceUrl: string | null = null;
    let apiKey: string | null = null;

    const { data: accessibleInstance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('instance_url, n8n_api_key')
      .eq('id', instanceId)
      .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
      .maybeSingle();

    if (accessibleInstance) {
      instanceUrl = accessibleInstance.instance_url;
      apiKey = accessibleInstance.n8n_api_key;
    } else {
      // Check if user is the agency for this client instance via client_instances
      const { data: clientInstance } = await supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('instance_id', instanceId)
        .eq('invited_by', effectiveUserId)
        .maybeSingle();

      if (clientInstance) {
        // Fetch instance details
        const { data: inst } = await supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('instance_url, n8n_api_key')
          .eq('id', instanceId)
          .maybeSingle();

        if (inst) {
          instanceUrl = inst.instance_url;
          apiKey = inst.n8n_api_key;
        }
      } else {
        // Fallback: check dedicated instances (n8n_instances table)
        const { data: dedicatedInstance } = await supabaseAdmin
          .from('n8n_instances')
          .select('instance_url, n8n_api_key')
          .eq('id', instanceId)
          .eq('user_id', effectiveUserId)
          .neq('status', 'deleted')
          .maybeSingle();

        if (dedicatedInstance) {
          instanceUrl = dedicatedInstance.instance_url;
          apiKey = dedicatedInstance.n8n_api_key;
        }
      }
    }

    if (!instanceUrl || !apiKey) {
      return NextResponse.json({ error: 'Access denied or instance not configured' }, { status: 403 });
    }

    // Toggle workflow using the helper
    const result = await toggleN8nWorkflow(
      instanceUrl,
      apiKey,
      workflowId,
      active
    );

    if (!result.success) {
      // Parse and enhance the error message
      let errorMessage = result.error || 'Failed to toggle workflow';
      let statusCode = 500;

      // Check for common error patterns
      if (errorMessage.includes('404') || errorMessage.toLowerCase().includes('not found')) {
        errorMessage = 'Workflow not found. It may have been deleted.';
        statusCode = 404;
      } else if (errorMessage.includes('401') || errorMessage.includes('403') || errorMessage.toLowerCase().includes('unauthorized')) {
        errorMessage = 'API key is invalid or lacks permission to toggle workflows.';
        statusCode = 403;
      } else if (errorMessage.toLowerCase().includes('cannot be activated') || errorMessage.toLowerCase().includes('error')) {
        errorMessage = 'Workflow cannot be toggled. It may have configuration errors that need to be fixed first.';
        statusCode = 400;
      }

      return NextResponse.json({ error: errorMessage }, { status: statusCode });
    }

    return NextResponse.json({ success: true, active });
  } catch (error) {
    console.error('Toggle workflow error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
