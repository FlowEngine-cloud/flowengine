import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

/**
 * POST /api/instances/link-external
 * Creates an external instance (pay_per_instance_deployments) and assigns it
 * to a client via client_instances.
 *
 * Body:
 *   name         - instance display name (required)
 *   serviceType  - 'n8n' | 'openclaw' | 'other' (required)
 *   instanceUrl  - service URL (required for n8n/openclaw, optional for other)
 *   apiKey       - API key (required for n8n only)
 *   clientUserId - the client's user ID to assign this to (required)
 *   clientAccess - boolean, whether client can see the instance (default false)
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const ownerId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const body = await req.json();
    const { name, serviceType, instanceUrl, apiKey, clientUserId, clientAccess } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
    }
    if (serviceType !== 'n8n' && serviceType !== 'openclaw' && serviceType !== 'other') {
      return NextResponse.json({ error: 'serviceType must be n8n, openclaw, or other' }, { status: 400 });
    }
    if (serviceType !== 'other' && (!instanceUrl || typeof instanceUrl !== 'string' || !instanceUrl.trim())) {
      return NextResponse.json({ error: 'instanceUrl is required for n8n and openclaw' }, { status: 400 });
    }
    if (serviceType === 'n8n' && (!apiKey || typeof apiKey !== 'string' || !apiKey.trim())) {
      return NextResponse.json({ error: 'apiKey is required for n8n' }, { status: 400 });
    }
    if (!clientUserId || typeof clientUserId !== 'string') {
      return NextResponse.json({ error: 'clientUserId is required' }, { status: 400 });
    }

    // Normalize URL if provided
    let normalizedUrl: string | null = null;
    if (instanceUrl && typeof instanceUrl === 'string' && instanceUrl.trim()) {
      try {
        const parsed = new URL(instanceUrl.trim());
        if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Invalid protocol');
        normalizedUrl = parsed.origin + parsed.pathname.replace(/\/+$/, '');
      } catch {
        return NextResponse.json({ error: 'Invalid instanceUrl' }, { status: 400 });
      }
    }

    // Create the external instance
    const { data: instance, error: insertError } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .insert({
        user_id: ownerId,
        instance_name: name.trim().substring(0, 50),
        instance_url: normalizedUrl,
        n8n_api_key: serviceType === 'n8n' ? (apiKey?.trim() || null) : null,
        status: 'active',
        is_external: true,
        storage_limit_gb: 0,
        service_type: serviceType,
        subscription_status: 'active',
      })
      .select('id, instance_name, instance_url, status, service_type')
      .single();

    if (insertError || !instance) {
      console.error('[link-external] Insert error:', insertError);
      return NextResponse.json({ error: 'Failed to create instance' }, { status: 500 });
    }

    // Assign the instance to the client
    const { error: assignError } = await supabaseAdmin
      .from('client_instances')
      .insert({
        instance_id: instance.id,
        user_id: clientUserId,
        invited_by: ownerId,
      });

    if (assignError) {
      console.error('[link-external] Assign error:', assignError);
      // Still return success — the instance was created
    }

    return NextResponse.json({ success: true, instance });
  } catch (error) {
    console.error('[link-external] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
