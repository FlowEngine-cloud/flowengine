import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}

/**
 * POST /api/hosting/connect
 * Connect an existing external instance (n8n or OpenClaw) to the portal.
 * Creates a pay_per_instance_deployments row with is_external=true.
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { instanceName, instanceUrl, apiKey, serviceType } = body;

    if (!instanceName || typeof instanceName !== 'string') {
      return NextResponse.json({ error: 'Instance name is required' }, { status: 400 });
    }
    if (!instanceUrl || typeof instanceUrl !== 'string') {
      return NextResponse.json({ error: 'Instance URL is required' }, { status: 400 });
    }
    if (serviceType !== 'n8n' && serviceType !== 'openclaw') {
      return NextResponse.json({ error: 'Service type must be n8n or openclaw' }, { status: 400 });
    }
    if (serviceType === 'n8n' && (!apiKey || typeof apiKey !== 'string')) {
      return NextResponse.json({ error: 'API key is required for n8n instances' }, { status: 400 });
    }

    // Validate URL format
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(instanceUrl);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('Invalid protocol');
      }
    } catch {
      return NextResponse.json({ error: 'Invalid instance URL' }, { status: 400 });
    }

    // Normalize URL (remove trailing slash)
    const normalizedUrl = parsedUrl.origin + parsedUrl.pathname.replace(/\/+$/, '');

    // Check for duplicate URL
    const { data: existing } = await getSupabaseAdmin()
      .from('pay_per_instance_deployments')
      .select('id')
      .eq('instance_url', normalizedUrl)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: 'An instance with this URL already exists' }, { status: 409 });
    }

    // Insert external instance
    const { data: instance, error: insertError } = await getSupabaseAdmin()
      .from('pay_per_instance_deployments')
      .insert({
        user_id: user.id,
        instance_name: instanceName.trim().substring(0, 50),
        instance_url: normalizedUrl,
        n8n_api_key: apiKey || null,
        status: 'active',
        is_external: true,
        storage_limit_gb: 0,
        service_type: serviceType,
        subscription_status: 'active',
      })
      .select('id, instance_name, instance_url, status, service_type')
      .single();

    if (insertError) {
      console.error('[hosting/connect] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to register instance' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      instance,
    });
  } catch (error) {
    console.error('[hosting/connect] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
