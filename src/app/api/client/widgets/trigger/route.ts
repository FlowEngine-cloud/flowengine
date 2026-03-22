import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, isValidWebhookUrl, checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Trigger a component (proxied through server for security)
export async function POST(req: NextRequest) {
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

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const { widgetId, formData } = await req.json();

    if (!widgetId) {
      return NextResponse.json({ error: 'Widget ID required' }, { status: 400 });
    }

    // Validate UUID format
    if (!isValidUUID(widgetId)) {
      return NextResponse.json({ error: 'Invalid widget ID format' }, { status: 400 });
    }

    // Rate limiting: max 30 component triggers per minute per user
    const rateLimitResult = checkRateLimit(`widget-trigger:${user.id}`, 30, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please slow down.' },
        { status: 429 }
      );
    }

    // Get the component with instance info
    const { data: widget } = await supabaseAdmin
      .from('client_widgets')
      .select(`
        id,
        webhook_url,
        widget_type,
        instance_id
      `)
      .eq('id', widgetId)
      .single();

    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    // Template widgets (no instance_id) cannot be triggered - they must be assigned first
    if (!widget.instance_id) {
      return NextResponse.json(
        { error: 'This is a template widget. Assign it to an instance before triggering.' },
        { status: 400 }
      );
    }

    // Verify user has access to this component's instance (run queries in parallel)
    const [{ data: instance }, { data: clientInstance }] = await Promise.all([
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('user_id, instance_url, deleted_at, subscription_status')
        .eq('id', widget.instance_id)
        .maybeSingle(),
      supabaseAdmin
        .from('client_instances')
        .select('user_id, invited_by')
        .eq('instance_id', widget.instance_id)
        .maybeSingle(),
    ]);

    // Instance must exist for widget to be triggered
    if (!instance) {
      return NextResponse.json({ error: 'Widget instance not found' }, { status: 404 });
    }

    // Instance must not be deleted
    if (instance.deleted_at) {
      return NextResponse.json({ error: 'Instance is no longer available' }, { status: 404 });
    }

    // Instance must have active subscription
    if (instance.subscription_status !== 'active' && instance.subscription_status !== 'trialing') {
      return NextResponse.json({ error: 'Instance subscription is not active' }, { status: 403 });
    }

    const isOwner = instance.user_id === effectiveUserId;
    const isClient = clientInstance?.user_id === user.id;
    const isAgency = clientInstance?.invited_by === effectiveUserId;

    if (!isOwner && !isClient && !isAgency) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // SECURITY: Verify the component's webhook URL still points to the instance
    // This prevents attacks where widget was created with valid URL but instance changed
    if (instance.instance_url) {
      const webhookValidation = isValidWebhookUrl(widget.webhook_url, instance.instance_url);
      if (!webhookValidation.valid) {
        return NextResponse.json(
          { error: 'component configuration is invalid. Please contact your administrator.' },
          { status: 400 }
        );
      }
    }

    // Trigger the webhook server-side
    try {
      const response = await fetch(widget.webhook_url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'FlowEngine-Widget/1.0',
        },
        body: JSON.stringify(formData || {}),
        signal: AbortSignal.timeout(30000), // 30 second timeout
      });

      // We don't expose the full response to prevent information leakage
      // Just return success/failure
      if (response.ok) {
        return NextResponse.json({ success: true });
      } else {
        console.error('Webhook trigger failed:', response.status);
        return NextResponse.json(
          { success: false, error: 'Webhook returned an error' },
          { status: 502 }
        );
      }
    } catch (fetchError) {
      console.error('Failed to trigger webhook:', fetchError);
      return NextResponse.json(
        { success: false, error: 'Failed to reach webhook endpoint' },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error('Widget trigger error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
