import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { verifyN8nApiKey } from '@/lib/n8nInstanceApi';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Verify n8n API key works for an instance
export async function POST(
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

    // Check pay-per-instance deployments first
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, instance_url, n8n_api_key, invited_by_user_id')
      .eq('id', instanceId)
      .maybeSingle();

    // If not found, check dedicated instances (n8n_instances table)
    let isDedicated = false;
    let instanceUrl: string | null = null;
    let apiKey: string | null = null;

    if (!instance) {
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('id, user_id, instance_url, n8n_api_key')
        .eq('id', instanceId)
        .eq('user_id', effectiveUserId)
        .neq('status', 'deleted')
        .maybeSingle();

      if (!dedicatedInstance) {
        return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
      }
      isDedicated = true;
      instanceUrl = dedicatedInstance.instance_url;
      apiKey = dedicatedInstance.n8n_api_key;
    } else {
      // For pay-per-instance: verify user is owner or agency
      let hasAccess = instance.user_id === effectiveUserId || instance.invited_by_user_id === effectiveUserId;

      if (!hasAccess) {
        const { data: clientInstance } = await supabaseAdmin
          .from('client_instances')
          .select('id')
          .eq('instance_id', instanceId)
          .eq('invited_by', effectiveUserId)
          .maybeSingle();

        hasAccess = !!clientInstance;
      }

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      instanceUrl = instance.instance_url;
      apiKey = instance.n8n_api_key;
    }

    // Check if API key exists
    if (!apiKey || !instanceUrl) {
      return NextResponse.json({
        verified: false,
        error: 'API key or instance URL not configured',
      });
    }

    // Verify the API key
    const result = await verifyN8nApiKey(instanceUrl, apiKey);

    return NextResponse.json({
      verified: result.valid,
      error: result.error,
    });
  } catch (error) {
    console.error('API key verification error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
