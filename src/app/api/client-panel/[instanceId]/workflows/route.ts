import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { fetchN8nWorkflows } from '@/lib/n8nInstanceApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET: List workflows from n8n instance
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const { instanceId } = await params;

    // Validate UUID format
    if (!isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Invalid instance ID format' }, { status: 400 });
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

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // SECURITY: Check access BEFORE querying sensitive instance data
    // Check: owner (user_id) OR agency manager (invited_by_user_id) OR agency via client_instances
    const [{ data: accessibleInstance }, { data: clientInstance }] = await Promise.all([
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, instance_url, n8n_api_key')
        .eq('id', instanceId)
        .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
        .maybeSingle(),
      supabaseAdmin
        .from('client_instances')
        .select(`
          id,
          instance:pay_per_instance_deployments!inner(id, instance_url, n8n_api_key)
        `)
        .eq('instance_id', instanceId)
        .eq('invited_by', effectiveUserId)
        .maybeSingle(),
    ]);

    // Determine which access path succeeded
    let instance = accessibleInstance;
    if (!instance && clientInstance?.instance) {
      // Supabase join returns the object directly (not an array) with !inner
      const instanceData = clientInstance.instance as unknown as { id: string; instance_url: string; n8n_api_key: string };
      instance = instanceData;
    }

    // Fallback: check dedicated instances (n8n_instances table)
    if (!instance) {
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('id, instance_url, n8n_api_key')
        .eq('id', instanceId)
        .eq('user_id', effectiveUserId)
        .neq('status', 'deleted')
        .maybeSingle();

      if (dedicatedInstance) {
        instance = dedicatedInstance;
      }
    }

    // No access - return generic error (don't reveal if instance exists)
    if (!instance) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!instance.n8n_api_key || !instance.instance_url) {
      return NextResponse.json({ workflows: [], message: 'API key not configured' });
    }

    // Fetch workflows from n8n using helper (handles SSL bypass)
    const result = await fetchN8nWorkflows(instance.instance_url, instance.n8n_api_key);

    if (result.error) {
      console.error('n8n fetch error:', result.error);
      return NextResponse.json({ workflows: [], error: result.error });
    }

    // Debug: Log credential extraction status
    const workflowsWithCreds = result.workflows.filter(w => w.requiredCredentials && w.requiredCredentials.length > 0);
    console.log(`[Workflows] Fetched ${result.workflows.length} workflows, ${workflowsWithCreds.length} have detected credentials`);
    if (workflowsWithCreds.length > 0) {
      console.log('[Workflows] Sample credentials:', workflowsWithCreds.slice(0, 3).map(w => ({
        name: w.name,
        credentials: w.requiredCredentials
      })));
    }

    // Pass through warning if credential detection failed for some workflows
    return NextResponse.json({
      workflows: result.workflows,
      ...(result.warning && { warning: result.warning }),
    });
  } catch (error) {
    console.error('Workflows fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
