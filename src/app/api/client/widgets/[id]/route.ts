import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, isValidWebhookUrl, sanitizeString, checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// PUT: Update a component
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: widgetId } = await params;

    // Validate UUID format
    if (!isValidUUID(widgetId)) {
      return NextResponse.json({ error: 'Invalid widget ID format' }, { status: 400 });
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

    // Rate limit: max 60 widget updates per minute per user
    const rateLimitResult = checkRateLimit(`widget-update:${user.id}`, 60, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many updates. Please wait a moment.' },
        { status: 429 }
      );
    }

    // Get widget to check ownership
    const { data: widget, error: widgetError } = await supabaseAdmin
      .from('client_widgets')
      .select('instance_id, created_by, user_id')
      .eq('id', widgetId)
      .single();

    if (widgetError || !widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    // Check direct ownership (for template widgets)
    const ownsDirectly = widget.user_id === effectiveUserId;
    const isCreator = widget.created_by === effectiveUserId;

    // Check instance-based ownership if widget has an instance
    let isOwner = false;
    let isAgency = false;
    let instanceUrl: string | undefined;

    if (widget.instance_id) {
      // Run queries in parallel for performance
      const [{ data: instance }, { data: clientInstance }] = await Promise.all([
        supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('user_id, instance_url')
          .eq('id', widget.instance_id)
          .maybeSingle(),
        supabaseAdmin
          .from('client_instances')
          .select('invited_by')
          .eq('instance_id', widget.instance_id)
          .maybeSingle(),
      ]);

      isOwner = instance?.user_id === effectiveUserId;
      isAgency = clientInstance?.invited_by === effectiveUserId;
      instanceUrl = instance?.instance_url;
    }

    if (!ownsDirectly && !isOwner && !isAgency && !isCreator) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await req.json();
    const { name, webhookUrl, webhookMethod, formFields, isActive, displayOrder, workflow_id, buttonColor, textColor, styles, instanceId } = body;

    // Validate webhook URL if being updated (SSRF prevention)
    if (webhookUrl !== undefined) {
      // If widget has an instance, require instance URL for validation
      if (widget.instance_id) {
        if (!instanceUrl) {
          return NextResponse.json({ error: 'Cannot validate webhook URL - instance configuration missing' }, { status: 400 });
        }
        const webhookValidation = isValidWebhookUrl(webhookUrl, instanceUrl);
        if (!webhookValidation.valid) {
          return NextResponse.json({ error: webhookValidation.error }, { status: 400 });
        }
      }
      // Template widgets (no instance) can have any webhook URL - validated when assigned to instance
    }

    // Validate and sanitize name if being updated
    if (name !== undefined) {
      const sanitizedName = sanitizeString(name, 100);
      if (!sanitizedName) {
        return NextResponse.json({ error: 'Invalid component name' }, { status: 400 });
      }
    }

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = sanitizeString(name, 100);
    if (webhookUrl !== undefined) updates.webhook_url = webhookUrl;
    if (webhookMethod !== undefined) updates.webhook_method = webhookMethod;
    if (formFields !== undefined) updates.form_fields = formFields;
    if (isActive !== undefined) updates.is_active = isActive;
    if (displayOrder !== undefined) updates.display_order = displayOrder;
    if (workflow_id !== undefined) updates.workflow_id = workflow_id;

    // Handle instance_id assignment
    if (instanceId !== undefined && isValidUUID(instanceId)) {
      updates.instance_id = instanceId;
    }

    // Handle styles - support both individual colors and full styles object
    if (styles !== undefined) {
      updates.styles = styles;
    } else if (buttonColor !== undefined || textColor !== undefined) {
      // Legacy: individual color fields - merge with existing
      updates.styles = {
        ...(buttonColor !== undefined && { buttonColor }),
        ...(textColor !== undefined && { textColor }),
      };
    }

    const { data: updatedWidget, error } = await supabaseAdmin
      .from('client_widgets')
      .update(updates)
      .eq('id', widgetId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update component:', error);
      return NextResponse.json({ error: 'Failed to update component' }, { status: 500 });
    }

    // Auto-link to category when assigning to an instance
    // This ensures the widget shows up in filtered views
    const targetInstanceId = instanceId || widget.instance_id;
    if (targetInstanceId) {
      try {
        // Find or create a category for this instance
        const { data: existingCategory } = await supabaseAdmin
          .from('widget_categories')
          .select('id')
          .eq('instance_id', targetInstanceId)
          .maybeSingle();

        let categoryId = existingCategory?.id;

        if (!categoryId) {
          // Get instance name for the category
          const { data: instanceData } = await supabaseAdmin
            .from('pay_per_instance_deployments')
            .select('instance_name')
            .eq('id', targetInstanceId)
            .maybeSingle();

          // Create a new category for this instance
          const { data: newCategory } = await supabaseAdmin
            .from('widget_categories')
            .insert({
              user_id: user.id,
              name: instanceData?.instance_name || 'Client',
              description: 'Auto-created category for client components',
              color: '#6366f1',
              display_order: 0,
              instance_id: targetInstanceId,
            })
            .select('id')
            .single();

          categoryId = newCategory?.id;
        }

        // Link the widget to the category if we have a category ID
        if (categoryId) {
          // Check if link already exists
          const { data: existingLink } = await supabaseAdmin
            .from('widget_category_links')
            .select('id')
            .eq('widget_id', widgetId)
            .eq('category_id', categoryId)
            .maybeSingle();

          if (!existingLink) {
            await supabaseAdmin
              .from('widget_category_links')
              .insert({
                widget_id: widgetId,
                category_id: categoryId,
              });
          }
        }
      } catch (err) {
        // Category linking is optional - don't fail the request
        console.warn('Could not auto-link to category:', err);
      }
    }

    return NextResponse.json({ widget: updatedWidget });
  } catch (error) {
    console.error('Widget PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Delete a component
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: widgetId } = await params;

    // Validate UUID format
    if (!isValidUUID(widgetId)) {
      return NextResponse.json({ error: 'Invalid widget ID format' }, { status: 400 });
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

    // Get widget to check ownership
    const { data: widget, error: widgetError } = await supabaseAdmin
      .from('client_widgets')
      .select('instance_id, created_by, user_id')
      .eq('id', widgetId)
      .single();

    if (widgetError || !widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    // Check direct ownership (for template widgets)
    const ownsDirectly = widget.user_id === effectiveUserId;
    const isCreator = widget.created_by === effectiveUserId;

    // Check instance-based ownership if widget has an instance
    let isOwner = false;
    let isAgency = false;

    if (widget.instance_id) {
      // Run queries in parallel for performance
      const [{ data: instance }, { data: clientInstance }] = await Promise.all([
        supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('user_id')
          .eq('id', widget.instance_id)
          .maybeSingle(),
        supabaseAdmin
          .from('client_instances')
          .select('invited_by')
          .eq('instance_id', widget.instance_id)
          .maybeSingle(),
      ]);

      isOwner = instance?.user_id === effectiveUserId;
      isAgency = clientInstance?.invited_by === effectiveUserId;
    }

    if (!ownsDirectly && !isOwner && !isAgency && !isCreator) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

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
