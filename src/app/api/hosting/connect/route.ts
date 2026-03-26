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
    if (serviceType !== 'n8n' && serviceType !== 'openclaw' && serviceType !== 'other') {
      return NextResponse.json({ error: 'Service type must be n8n, openclaw, or other' }, { status: 400 });
    }
    // URL required for n8n and openclaw, optional for other
    if (serviceType !== 'other' && (!instanceUrl || typeof instanceUrl !== 'string')) {
      return NextResponse.json({ error: 'Instance URL is required' }, { status: 400 });
    }
    if (serviceType === 'n8n' && (!apiKey || typeof apiKey !== 'string')) {
      return NextResponse.json({ error: 'API key is required for n8n instances' }, { status: 400 });
    }

    // Normalize URL if provided
    let normalizedUrl = '';
    if (instanceUrl && typeof instanceUrl === 'string' && instanceUrl.trim()) {
      let parsedUrl: URL;
      try {
        parsedUrl = new URL(instanceUrl.trim());
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
          throw new Error('Invalid protocol');
        }
        normalizedUrl = parsedUrl.origin + parsedUrl.pathname.replace(/\/+$/, '');
      } catch {
        return NextResponse.json({ error: 'Invalid instance URL' }, { status: 400 });
      }

      // Check for duplicate URL (only when URL is provided)
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
    }

    // Insert external instance
    const { data: instance, error: insertError } = await getSupabaseAdmin()
      .from('pay_per_instance_deployments')
      .insert({
        user_id: user.id,
        instance_name: instanceName.trim().substring(0, 50),
        instance_url: normalizedUrl || null,
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

/**
 * PATCH /api/hosting/connect
 * Update an external instance's URL and/or notes.
 */
export async function PATCH(req: NextRequest) {
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
    const { instanceId, instanceUrl, notes } = body;

    if (!instanceId || typeof instanceId !== 'string') {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};

    if (instanceUrl !== undefined) {
      const trimmed = typeof instanceUrl === 'string' ? instanceUrl.trim() : '';
      if (trimmed) {
        try {
          const parsed = new URL(trimmed);
          if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('invalid');
          updates.instance_url = parsed.origin + parsed.pathname.replace(/\/+$/, '');
        } catch {
          return NextResponse.json({ error: 'Invalid instance URL' }, { status: 400 });
        }
      } else {
        updates.instance_url = null;
      }
    }

    if (notes !== undefined) {
      updates.notes = typeof notes === 'string' ? (notes.trim().substring(0, 1000) || null) : null;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    const { data: instance, error } = await getSupabaseAdmin()
      .from('pay_per_instance_deployments')
      .update(updates)
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .select('id, instance_name, instance_url')
      .maybeSingle();

    if (error || !instance) {
      return NextResponse.json({ error: 'Instance not found or access denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true, instance });
  } catch (error) {
    console.error('[hosting/connect] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/hosting/connect
 * Remove an externally-connected instance (soft-delete).
 */
export async function DELETE(req: NextRequest) {
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
    const { instanceId } = body;

    if (!instanceId || typeof instanceId !== 'string') {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    const { error } = await getSupabaseAdmin()
      .from('pay_per_instance_deployments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', instanceId)
      .eq('user_id', user.id)
      .eq('is_external', true);

    if (error) {
      return NextResponse.json({ error: 'Failed to remove instance' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[hosting/connect] DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
