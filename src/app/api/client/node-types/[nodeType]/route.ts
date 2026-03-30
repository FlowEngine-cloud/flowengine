import { NextRequest, NextResponse } from 'next/server';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


/**
 * GET /api/client/node-types/[nodeType]?instanceId=xxx
 * Fetch node type information from n8n for dynamic field extraction
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ nodeType: string }> }
) {
  try {
    const { nodeType } = await params;
    const decodedNodeType = decodeURIComponent(nodeType);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId');
    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    // Resolve team access
    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get instance with access check — check pay_per_instance first, fall back to n8n_instances
    const [{ data: clientOwnedInstance }, { data: managerAccess }, { data: agencyAccess }] = await Promise.all([
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, instance_url, n8n_api_key, subscription_status')
        .eq('id', instanceId)
        .eq('user_id', effectiveUserId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, instance_url, n8n_api_key, subscription_status')
        .eq('id', instanceId)
        .eq('invited_by_user_id', effectiveUserId)
        .is('deleted_at', null)
        .maybeSingle(),
      supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('instance_id', instanceId)
        .eq('user_id', user.id)
        .maybeSingle()
    ]);

    let instance;
    if (clientOwnedInstance) {
      instance = clientOwnedInstance;
    } else if (managerAccess) {
      instance = managerAccess;
    } else if (agencyAccess) {
      const { data: agencyOwnedInstance } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('instance_url, n8n_api_key, subscription_status')
        .eq('id', instanceId)
        .is('deleted_at', null)
        .maybeSingle();
      instance = agencyOwnedInstance;
    }

    // Fallback: dedicated instance (n8n_instances table)
    if (!instance) {
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('id, instance_url, n8n_api_key')
        .eq('id', instanceId)
        .eq('user_id', effectiveUserId)
        .neq('status', 'deleted')
        .maybeSingle();

      if (dedicatedInstance) {
        instance = { ...dedicatedInstance, subscription_status: 'active' };
      }
    }

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or access denied' }, { status: 404 });
    }

    if (instance.subscription_status !== 'active' && instance.subscription_status !== 'trialing') {
      return NextResponse.json({ error: 'Instance subscription is not active' }, { status: 403 });
    }

    // Fetch node type info from n8n
    const nodeTypeResponse = await fetch(
      `${instance.instance_url}/api/v1/node-types/${encodeURIComponent(decodedNodeType)}`,
      {
        method: 'GET',
        headers: {
          'X-N8N-API-KEY': instance.n8n_api_key,
        },
      }
    );

    if (!nodeTypeResponse.ok) {
      return NextResponse.json({
        error: 'Node type not found',
        message: 'This n8n version may not support node type API'
      }, { status: 404 });
    }

    const nodeTypeData = await nodeTypeResponse.json();

    return NextResponse.json({
      success: true,
      nodeType: nodeTypeData
    });
  } catch (error) {
    console.error('Fetch node type error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
