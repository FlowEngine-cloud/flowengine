import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET: Get user's n8n instances for workflow/widget assignment
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Fetch pay-per-instance deployments (owned or agency-managed)
    const { data: payPerInstances, error: payPerError } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, instance_name, instance_url, status, n8n_api_key, storage_limit_gb, is_external')
      .or(`user_id.eq.${user.id},invited_by_user_id.eq.${user.id}`)
      .neq('subscription_status', 'canceled')
      .is('deleted_at', null)
      .or('is_external.eq.false,is_external.is.null') // exclude self-hosted external instances; not manageable via API
      .order('created_at', { ascending: false });

    if (payPerError) {
      console.error('Error fetching pay-per-instance:', payPerError);
    }

    const instances = (payPerInstances || []).map(inst => ({
      id: inst.id,
      instance_name: inst.instance_name,
      instance_url: inst.instance_url,
      status: inst.status,
      hasApiKey: !!inst.n8n_api_key,
      type: 'pay-per-instance' as const,
      storage_limit_gb: inst.storage_limit_gb || 0,
    }));

    return NextResponse.json({ instances });
  } catch (error) {
    console.error('User instances error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
