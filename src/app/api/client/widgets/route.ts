import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, isValidWebhookUrl, sanitizeString, checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET: List UI components for an instance
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

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Check if user is a client or an agency
    const instanceId = req.nextUrl.searchParams.get('instanceId');

    let targetInstanceId = instanceId;

    // If no instanceId provided, try to get client's instance from BOTH sources
    if (!targetInstanceId) {
      // Check both: agency-owned (client_instances) and client-owned (pay_per_instance_deployments)
      const [{ data: clientInstanceRecord }, { data: clientOwnedInstance }] = await Promise.all([
        supabaseAdmin
          .from('client_instances')
          .select('instance_id')
          .eq('user_id', effectiveUserId)
          .maybeSingle(),
        supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('id')
          .eq('user_id', effectiveUserId)
          .not('invited_by_user_id', 'is', null)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle()
      ]);

      // Prefer client-owned instance, then agency-owned
      if (clientOwnedInstance) {
        targetInstanceId = clientOwnedInstance.id;
      } else if (clientInstanceRecord) {
        targetInstanceId = clientInstanceRecord.instance_id;
      }
    }

    if (!targetInstanceId) {
      return NextResponse.json({ error: 'Instance ID required' }, { status: 400 });
    }

    // Validate UUID format
    if (!isValidUUID(targetInstanceId)) {
      return NextResponse.json({ error: 'Invalid instance ID format' }, { status: 400 });
    }

    // Verify access to this instance (run queries in parallel)
    const [{ data: instance }, { data: clientInstance }] = await Promise.all([
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('user_id, deleted_at, subscription_status')
        .eq('id', targetInstanceId)
        .maybeSingle(),
      supabaseAdmin
        .from('client_instances')
        .select('user_id, invited_by')
        .eq('instance_id', targetInstanceId)
        .maybeSingle(),
    ]);

    const isOwner = instance?.user_id === effectiveUserId;
    const isClient = clientInstance?.user_id === effectiveUserId;
    const isAgency = clientInstance?.invited_by === effectiveUserId;

    // Fallback: dedicated instance (n8n_instances table)
    let isDedicated = false;
    if (!isOwner && !isClient && !isAgency) {
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('id')
        .eq('id', targetInstanceId)
        .eq('user_id', effectiveUserId)
        .neq('status', 'deleted')
        .maybeSingle();

      if (dedicatedInstance) {
        isDedicated = true;
      }
    }

    if (!isOwner && !isClient && !isAgency && !isDedicated) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check instance status (clients cannot access deleted/inactive instances)
    if (!isOwner && !isAgency && !isDedicated) {
      if (instance?.deleted_at) {
        return NextResponse.json({ error: 'Instance is no longer available' }, { status: 404 });
      }
      if (instance?.subscription_status !== 'active' && instance?.subscription_status !== 'trialing') {
        return NextResponse.json({ error: 'Instance subscription is not active' }, { status: 403 });
      }
    }

    // Get widgets (exclude drafts with __DRAFT__ prefix)
    const { data: widgets, error } = await supabaseAdmin
      .from('client_widgets')
      .select('*')
      .eq('instance_id', targetInstanceId)
      .not('name', 'like', '__DRAFT__%')
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Failed to fetch widgets:', error);
      return NextResponse.json({ error: 'Failed to fetch widgets' }, { status: 500 });
    }

    return NextResponse.json({ widgets });
  } catch (error) {
    console.error('Widgets GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Create a new component
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

    // Rate limit: max 20 widget creations per minute per user
    const rateLimitResult = checkRateLimit(`widget-create:${user.id}`, 20, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many widget creations. Please wait a moment.' },
        { status: 429 }
      );
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const { instanceId, name, widgetType, webhookUrl, formFields, workflowId, workflowName, templateId, buttonColor, textColor } = await req.json();

    if (!instanceId || !name || !widgetType || !webhookUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!['button', 'form', 'chatbot'].includes(widgetType)) {
      return NextResponse.json({ error: 'Invalid component type' }, { status: 400 });
    }

    // Validate UUID format for instanceId
    if (!isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Invalid instance ID format' }, { status: 400 });
    }

    // Validate and sanitize name
    const sanitizedName = sanitizeString(name, 100);
    if (!sanitizedName) {
      return NextResponse.json({ error: 'Invalid component name' }, { status: 400 });
    }

    // Verify access to this instance (must be agency/owner, run in parallel)
    const [{ data: instance }, { data: clientInstance }] = await Promise.all([
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('user_id, instance_url, deleted_at, subscription_status')
        .eq('id', instanceId)
        .maybeSingle(),
      supabaseAdmin
        .from('client_instances')
        .select('invited_by')
        .eq('instance_id', instanceId)
        .maybeSingle(),
    ]);

    const isOwner = instance?.user_id === effectiveUserId;
    const isAgency = clientInstance?.invited_by === effectiveUserId;

    if (!isOwner && !isAgency) {
      return NextResponse.json({ error: 'Only the instance owner or agency can create UI components' }, { status: 403 });
    }

    // Check instance is not deleted and has active subscription
    if (instance?.deleted_at) {
      return NextResponse.json({ error: 'Cannot create UI components on a deleted instance' }, { status: 400 });
    }
    if (instance?.subscription_status !== 'active' && instance?.subscription_status !== 'trialing') {
      return NextResponse.json({ error: 'Instance subscription is not active' }, { status: 403 });
    }

    // Validate webhook URL (SSRF prevention)
    const webhookValidation = isValidWebhookUrl(webhookUrl, instance?.instance_url);
    if (!webhookValidation.valid) {
      return NextResponse.json({ error: webhookValidation.error }, { status: 400 });
    }

    // Get next display order atomically (prevents race conditions)
    const { data: displayOrderResult, error: displayOrderError } = await supabaseAdmin
      .rpc('get_next_widget_display_order', { p_instance_id: instanceId });

    // Fallback to manual calculation if RPC not available
    let displayOrder = 1;
    if (displayOrderError) {
      console.warn('get_next_widget_display_order RPC not available, using fallback:', displayOrderError.message);
      const { data: maxOrderWidget } = await supabaseAdmin
        .from('client_widgets')
        .select('display_order')
        .eq('instance_id', instanceId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();
      displayOrder = (maxOrderWidget?.display_order || 0) + 1;
    } else {
      displayOrder = displayOrderResult || 1;
    }

    // create component
    const { data: widget, error } = await supabaseAdmin
      .from('client_widgets')
      .insert({
        instance_id: instanceId,
        user_id: user.id,
        created_by: user.id,
        name: sanitizedName,
        widget_type: widgetType,
        webhook_url: webhookUrl,
        form_fields: widgetType === 'form' ? formFields : null,
        display_order: displayOrder,
        workflow_id: workflowId || null,
        workflow_name: workflowName || null,
        template_id: templateId || null,
        styles: (buttonColor || textColor) ? { buttonColor, textColor } : {},
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to create component:', error);
      return NextResponse.json({ error: 'Failed to create component' }, { status: 500 });
    }

    return NextResponse.json({ widget });
  } catch (error) {
    console.error('Widget POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete a component
export async function DELETE(req: NextRequest) {
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

    // Rate limit: max 30 widget deletions per minute per user
    const rateLimitResult = checkRateLimit(`widget-delete:${user.id}`, 30, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many deletions. Please wait a moment.' },
        { status: 429 }
      );
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const widgetId = req.nextUrl.searchParams.get('id');
    if (!widgetId) {
      return NextResponse.json({ error: 'Widget ID required' }, { status: 400 });
    }

    // Validate UUID format
    if (!isValidUUID(widgetId)) {
      return NextResponse.json({ error: 'Invalid widget ID format' }, { status: 400 });
    }

    // Get the component to check ownership
    const { data: widget } = await supabaseAdmin
      .from('client_widgets')
      .select('instance_id, created_by')
      .eq('id', widgetId)
      .maybeSingle();

    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    // Check if user is the creator, instance owner, or agency (run in parallel)
    const [{ data: instance }, { data: clientInstance }] = await Promise.all([
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('user_id, deleted_at, subscription_status')
        .eq('id', widget.instance_id)
        .maybeSingle(),
      supabaseAdmin
        .from('client_instances')
        .select('invited_by')
        .eq('instance_id', widget.instance_id)
        .maybeSingle(),
    ]);

    const isCreator = widget.created_by === effectiveUserId;
    const isOwner = instance?.user_id === effectiveUserId;
    const isAgency = clientInstance?.invited_by === effectiveUserId;

    if (!isCreator && !isOwner && !isAgency) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check instance status (only owners/agencies can delete on inactive instances)
    if (!isOwner && !isAgency) {
      if (instance?.deleted_at) {
        return NextResponse.json({ error: 'Instance is no longer available' }, { status: 404 });
      }
      if (instance?.subscription_status !== 'active' && instance?.subscription_status !== 'trialing') {
        return NextResponse.json({ error: 'Instance subscription is not active' }, { status: 403 });
      }
    }

    // Delete the component
    const { error } = await supabaseAdmin
      .from('client_widgets')
      .delete()
      .eq('id', widgetId);

    if (error) {
      console.error('Failed to delete component:', error);
      return NextResponse.json({ error: 'Failed to delete component' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Widget DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
