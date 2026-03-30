import { NextRequest, NextResponse } from 'next/server';
import { SupabaseClient } from '@supabase/supabase-js';
import { isValidUUID, isValidWebhookUrl, sanitizeString, validateAndSanitizeCSS } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET /api/widget-studio/templates/[id] - Get a single template
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get user's owned instances, agency-managed instances, AND client-access instances
    const [{ data: userInstances }, { data: agencyInstances }, { data: clientAccessInstances }] = await Promise.all([
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id')
        .eq('user_id', effectiveUserId),
      supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('invited_by', effectiveUserId),
      supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('user_id', effectiveUserId),
    ]);

    const userInstanceIds = userInstances?.map(i => i.id) || [];
    const agencyInstanceIds = agencyInstances?.map(i => i.instance_id) || [];
    const clientInstanceIds = clientAccessInstances?.map(i => i.instance_id) || [];
    const allAccessibleInstanceIds = [...new Set([...userInstanceIds, ...agencyInstanceIds, ...clientInstanceIds])];

    // Fetch the component
    const { data: widget, error } = await supabaseAdmin
      .from('client_widgets')
      .select(`
        *,
        instance:pay_per_instance_deployments(id, instance_name, user_id)
      `)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Error fetching widget:', error);
      return NextResponse.json({ error: 'Failed to fetch widget' }, { status: 500 });
    }

    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    // Verify access - widget must be owned by user directly OR via instance (owned or agency)
    const ownsDirectly = widget.user_id === effectiveUserId;
    const ownsViaInstance = widget.instance_id && allAccessibleInstanceIds.includes(widget.instance_id);

    if (!ownsDirectly && !ownsViaInstance) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ widget });
  } catch (error) {
    console.error('Templates GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT /api/widget-studio/templates/[id] - Update a template
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const body = await request.json();
    const { name, widget_type, form_fields, chatbot_config, webhook_url, instance_id, styles, is_active } = body;

    // Build update object with only provided fields
    const updates: Record<string, unknown> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Component name cannot be empty' }, { status: 400 });
      }
      updates.name = name.trim().substring(0, 100);
    }

    if (widget_type !== undefined) {
      if (!['button', 'form', 'chatbot'].includes(widget_type)) {
        return NextResponse.json({ error: 'component type must be "button", "form", or "chatbot"' }, { status: 400 });
      }
      updates.widget_type = widget_type;
    }

    if (form_fields !== undefined) {
      // If changing to/from form type, validate fields
      const effectiveType = widget_type ?? (await getTemplateType(supabaseAdmin, id));

      if (effectiveType === 'form') {
        if (!Array.isArray(form_fields) || form_fields.length === 0) {
          return NextResponse.json({ error: 'form components require at least one field' }, { status: 400 });
        }
        // Limit form fields to prevent abuse
        if (form_fields.length > 50) {
          return NextResponse.json({ error: 'Maximum 50 form fields allowed' }, { status: 400 });
        }
        const validTypes = ['text', 'email', 'number', 'textarea', 'select', 'date', 'time', 'file', 'checkbox', 'radio', 'phone', 'url'];
        for (const field of form_fields) {
          if (!field.name || typeof field.name !== 'string') {
            return NextResponse.json({ error: 'Each form field must have a name' }, { status: 400 });
          }
          // Sanitize field name to prevent XSS
          field.name = sanitizeString(field.name, 100);
          if (!field.type || !validTypes.includes(field.type)) {
            return NextResponse.json({ error: 'Invalid field type' }, { status: 400 });
          }
        }
        updates.form_fields = form_fields;
      } else {
        updates.form_fields = null;
      }
    }

    if (chatbot_config !== undefined) {
      // If changing to/from chatbot type, save config
      const effectiveType = widget_type ?? (await getTemplateType(supabaseAdmin, id));

      if (effectiveType === 'chatbot') {
        // SECURITY: Sanitize custom CSS
        if (chatbot_config?.customCSS) {
          const cssResult = validateAndSanitizeCSS(chatbot_config.customCSS, 10000);
          if (!cssResult.valid) {
            return NextResponse.json({ error: cssResult.error }, { status: 400 });
          }
          chatbot_config.customCSS = cssResult.sanitized;
        }
        updates.chatbot_config = chatbot_config;
      } else {
        updates.chatbot_config = null;
      }
    }

    if (webhook_url !== undefined) {
      updates.webhook_url = webhook_url?.trim() || '';
    }

    if (instance_id !== undefined) {
      if (instance_id === null) {
        updates.instance_id = null;
      } else {
        if (!isValidUUID(instance_id)) {
          return NextResponse.json({ error: 'Invalid instance ID' }, { status: 400 });
        }
        // Verify instance access - check both owner and agency
        const [{ data: instance }, { data: clientInstance }] = await Promise.all([
          supabaseAdmin
            .from('pay_per_instance_deployments')
            .select('id, instance_url, user_id')
            .eq('id', instance_id)
            .maybeSingle(),
          supabaseAdmin
            .from('client_instances')
            .select('invited_by')
            .eq('instance_id', instance_id)
            .maybeSingle(),
        ]);

        const isInstanceOwner = instance?.user_id === effectiveUserId;
        const isAgency = clientInstance?.invited_by === effectiveUserId;

        if (!instance || (!isInstanceOwner && !isAgency)) {
          return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
        }

        // Validate webhook URL against the new instance (SSRF prevention)
        // Only validate if it looks like a URL or path (starts with http or /)
        let webhookToValidate = updates.webhook_url as string | undefined;
        if (webhookToValidate && instance.instance_url) {
          // Skip validation for empty or non-URL values (legacy data cleanup)
          const looksLikeUrl = webhookToValidate.startsWith('http') || webhookToValidate.startsWith('/');
          if (looksLikeUrl) {
            // If user entered a relative path (e.g., /webhook/abc), prepend the instance URL
            if (webhookToValidate.startsWith('/')) {
              try {
                const instanceUrl = new URL(instance.instance_url);
                webhookToValidate = `${instanceUrl.origin}${webhookToValidate}`;
                updates.webhook_url = webhookToValidate; // Store the full URL
              } catch {
                return NextResponse.json({ error: 'Invalid instance URL configuration' }, { status: 400 });
              }
            }
            const webhookValidation = isValidWebhookUrl(webhookToValidate, instance.instance_url);
            if (!webhookValidation.valid) {
              return NextResponse.json({ error: webhookValidation.error }, { status: 400 });
            }
          } else {
            // Clear invalid webhook URLs
            updates.webhook_url = '';
          }
        }

        updates.instance_id = instance_id;
      }
    }

    if (styles !== undefined) {
      // SECURITY: Sanitize custom CSS in styles
      if (styles?.customCSS) {
        const cssResult = validateAndSanitizeCSS(styles.customCSS, 10000);
        if (!cssResult.valid) {
          return NextResponse.json({ error: cssResult.error }, { status: 400 });
        }
        styles.customCSS = cssResult.sanitized;
      }
      updates.styles = styles || null;
    }

    if (is_active !== undefined) {
      const wantActive = Boolean(is_active);
      updates.is_active = wantActive;
    }

    // Handle workflow_id (can be a number, string, or null to unlink)
    const workflow_id = body.workflow_id;
    if (workflow_id !== undefined) {
      updates.workflow_id = workflow_id === null ? null : workflow_id;
    }

    // Handle workflow_name (for display purposes)
    const workflow_name = body.workflow_name;
    if (workflow_name !== undefined) {
      updates.workflow_name = workflow_name === null ? null : String(workflow_name).substring(0, 200);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    // Get user's owned instances, agency-managed instances, AND client-access instances
    const [{ data: userInstances }, { data: agencyInstances }, { data: clientAccessInstances }] = await Promise.all([
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id')
        .eq('user_id', effectiveUserId),
      supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('invited_by', effectiveUserId),
      supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('user_id', effectiveUserId),
    ]);

    const userInstanceIds = userInstances?.map(i => i.id) || [];
    const agencyInstanceIds = agencyInstances?.map(i => i.instance_id) || [];
    const clientInstanceIds = clientAccessInstances?.map(i => i.instance_id) || [];
    const allAccessibleInstanceIds = [...new Set([...userInstanceIds, ...agencyInstanceIds, ...clientInstanceIds])];

    // Check if widget exists and belongs to user
    const { data: existingWidget } = await supabaseAdmin
      .from('client_widgets')
      .select('id, instance_id, user_id')
      .eq('id', id)
      .single();

    if (!existingWidget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    // Verify access - widget must be owned by user directly OR via instance (owned or agency)
    const ownsDirectly = existingWidget.user_id === effectiveUserId;
    const ownsViaInstance = existingWidget.instance_id && allAccessibleInstanceIds.includes(existingWidget.instance_id);

    if (!ownsDirectly && !ownsViaInstance) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { data: template, error } = await supabaseAdmin
      .from('client_widgets')
      .update(updates)
      .eq('id', id)
      .select(`
        *,
        instance:pay_per_instance_deployments(id, instance_name, user_id)
      `)
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Auto-link to category when assigning to an instance
    // This ensures the widget shows up in filtered views
    if (instance_id !== undefined && instance_id !== null) {
      try {
        // Find or create a category for this instance
        const { data: existingCategory } = await supabaseAdmin
          .from('widget_categories')
          .select('id')
          .eq('instance_id', instance_id)
          .maybeSingle();

        let categoryId = existingCategory?.id;

        if (!categoryId) {
          // Get instance name for the category
          const { data: instanceData } = await supabaseAdmin
            .from('pay_per_instance_deployments')
            .select('instance_name')
            .eq('id', instance_id)
            .maybeSingle();

          // Create a new category for this instance
          const { data: newCategory } = await supabaseAdmin
            .from('widget_categories')
            .insert({
              user_id: effectiveUserId,
              name: instanceData?.instance_name || 'Client',
              description: 'Auto-created category for client components',
              color: '#6366f1',
              display_order: 0,
              instance_id: instance_id,
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
            .eq('widget_id', id)
            .eq('category_id', categoryId)
            .maybeSingle();

          if (!existingLink) {
            await supabaseAdmin
              .from('widget_category_links')
              .insert({
                widget_id: id,
                category_id: categoryId,
              });
          }
        }
      } catch (err) {
        // Category linking is optional - don't fail the request
        console.warn('Could not auto-link to category:', err);
      }
    }

    return NextResponse.json({ template });
  } catch (error) {
    console.error('Templates PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/widget-studio/templates/[id] - Delete a template
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get user's owned instances, agency-managed instances, AND client-access instances
    const [{ data: userInstances }, { data: agencyInstances }, { data: clientAccessInstances }] = await Promise.all([
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id')
        .eq('user_id', effectiveUserId),
      supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('invited_by', effectiveUserId),
      supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('user_id', effectiveUserId),
    ]);

    const userInstanceIds = userInstances?.map(i => i.id) || [];
    const agencyInstanceIds = agencyInstances?.map(i => i.instance_id) || [];
    const clientInstanceIds = clientAccessInstances?.map(i => i.instance_id) || [];
    const allAccessibleInstanceIds = [...new Set([...userInstanceIds, ...agencyInstanceIds, ...clientInstanceIds])];

    // Check if widget exists and belongs to user
    const { data: existingWidget } = await supabaseAdmin
      .from('client_widgets')
      .select('id, instance_id, user_id')
      .eq('id', id)
      .single();

    if (!existingWidget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    // Verify access - widget must be owned by user directly OR via instance (owned or agency)
    const ownsDirectly = existingWidget.user_id === effectiveUserId;
    const ownsViaInstance = existingWidget.instance_id && allAccessibleInstanceIds.includes(existingWidget.instance_id);

    if (!ownsDirectly && !ownsViaInstance) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('client_widgets')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Templates DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Helper function to get template type
async function getTemplateType(client: SupabaseClient, id: string): Promise<string | null> {
  const { data } = await client
    .from('client_widgets')
    .select('widget_type')
    .eq('id', id)
    .single();
  return data?.widget_type ?? null;
}
