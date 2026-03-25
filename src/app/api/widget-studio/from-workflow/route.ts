import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, isValidWebhookUrl } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST /api/widget-studio/from-workflow - Save a component generated from workflow builder
export async function POST(request: NextRequest) {
  try {
    // Authenticate user via Bearer token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Parse request body
    const body = await request.json();
    const { name, widget_type = 'chatbot', chatbot_config, form_fields, styles, webhook_url, category_ids } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Component name is required' }, { status: 400 });
    }

    // Validate component type
    if (!['chatbot', 'form', 'button'].includes(widget_type)) {
      return NextResponse.json({ error: 'Invalid component type' }, { status: 400 });
    }

    // Validate config based on component type
    if (widget_type === 'chatbot' && !chatbot_config) {
      return NextResponse.json({ error: 'Chatbot configuration is required' }, { status: 400 });
    }
    if (widget_type === 'form' && (!form_fields || !Array.isArray(form_fields) || form_fields.length === 0)) {
      return NextResponse.json({ error: 'Form fields are required' }, { status: 400 });
    }

    // Validate category IDs if provided (must be valid UUIDs)
    if (category_ids && Array.isArray(category_ids)) {
      for (const categoryId of category_ids) {
        if (typeof categoryId !== 'string' || !isValidUUID(categoryId)) {
          return NextResponse.json({ error: 'Invalid category ID format' }, { status: 400 });
        }
      }
      // Limit number of categories to prevent abuse
      if (category_ids.length > 10) {
        return NextResponse.json({ error: 'Maximum 10 categories allowed' }, { status: 400 });
      }
    }

    // Determine instance_id from selected category or fallback to user's owned instance
    let instanceId: string | undefined;
    let instanceUrl: string | undefined;

    // If category_ids provided, use the first category's instance_id
    if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
      const { data: category } = await supabaseAdmin
        .from('widget_categories')
        .select('instance_id, instance:pay_per_instance_deployments(id, instance_url, user_id)')
        .eq('id', category_ids[0])
        .maybeSingle();

      if (category?.instance_id) {
        // Verify user has access to this instance (owner, client, or agency)
        // The join returns an object (not array) when using maybeSingle()
        const instanceData = category.instance as unknown as { id: string; instance_url: string; user_id: string } | null;

        if (instanceData) {
          // Check if user is owner
          const isOwner = instanceData.user_id === effectiveUserId;

          // Check if user is client or agency of this instance
          const { data: clientInstance } = await supabaseAdmin
            .from('client_instances')
            .select('user_id, invited_by')
            .eq('instance_id', instanceData.id)
            .or(`user_id.eq.${effectiveUserId},invited_by.eq.${effectiveUserId}`)
            .maybeSingle();

          const hasAccess = isOwner || !!clientInstance;

          if (hasAccess) {
            instanceId = category.instance_id;
            instanceUrl = instanceData.instance_url;
          }
        }
      }
    }

    // Fallback: Get user's first owned instance if no category selected
    if (!instanceId) {
      const { data: instances } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, instance_url')
        .eq('user_id', effectiveUserId)
        .limit(1);

      instanceId = instances?.[0]?.id;
      instanceUrl = instances?.[0]?.instance_url;
    }

    // Validate webhook URL if provided (SSRF prevention)
    if (webhook_url && typeof webhook_url === 'string' && webhook_url.trim()) {
      const webhookValidation = isValidWebhookUrl(webhook_url, instanceUrl);
      if (!webhookValidation.valid) {
        return NextResponse.json(
          { error: webhookValidation.error || 'Invalid webhook URL' },
          { status: 400 }
        );
      }
    }

    // No watermark for open-source portal
    const showWatermark = false;

    // Merge watermark setting into chatbot config
    const finalChatbotConfig = {
      ...chatbot_config,
      showWatermark,
    };

    // Create the component
    const { data: widget, error: insertError } = await supabaseAdmin
      .from('client_widgets')
      .insert({
        name: name.trim(),
        widget_type,
        chatbot_config: widget_type === 'chatbot' ? finalChatbotConfig : null,
        form_fields: widget_type === 'form' ? form_fields : null,
        webhook_url: webhook_url || '',
        user_id: effectiveUserId,
        instance_id: instanceId,
        is_active: true,
        created_by: user.id,
        styles: styles || {},
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating widget:', insertError);
      return NextResponse.json(
        { error: 'Failed to create component' },
        { status: 500 }
      );
    }

    // Link categories if provided
    if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
      const categoryLinks = category_ids.map((categoryId: string) => ({
        widget_id: widget.id,
        category_id: categoryId,
      }));

      // Note: This requires a component_category_links table
      // If it doesn't exist, we skip this step
      try {
        await supabaseAdmin
          .from('widget_category_links')
          .insert(categoryLinks);
      } catch (err) {
        // Category linking is optional, don't fail the request
        console.warn('Could not link categories:', err);
      }
    } else if (instanceId) {
      // Auto-link to category when no categories provided but instance is set
      // This ensures the widget shows up in filtered views
      try {
        // Find or create a category for this instance
        const { data: existingCategory } = await supabaseAdmin
          .from('widget_categories')
          .select('id')
          .eq('instance_id', instanceId)
          .maybeSingle();

        let categoryId = existingCategory?.id;

        if (!categoryId) {
          // Get instance name for the category
          const { data: instanceData } = await supabaseAdmin
            .from('pay_per_instance_deployments')
            .select('instance_name')
            .eq('id', instanceId)
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
              instance_id: instanceId,
            })
            .select('id')
            .single();

          categoryId = newCategory?.id;
        }

        // Link the widget to the category
        if (categoryId) {
          await supabaseAdmin
            .from('widget_category_links')
            .insert({
              widget_id: widget.id,
              category_id: categoryId,
            });
        }
      } catch (err) {
        // Category linking is optional - don't fail the request
        console.warn('Could not auto-link to category:', err);
      }
    }

    // Clean up any existing drafts for this user (server-side cleanup)
    // Handles both legacy '__WORKFLOW_DRAFT__' and new '__DRAFT__<uuid>' formats
    try {
      await supabaseAdmin
        .from('client_widgets')
        .delete()
        .eq('user_id', effectiveUserId)
        .eq('is_active', false)
        .or('name.eq.__WORKFLOW_DRAFT__,name.like.__DRAFT__%');
    } catch (err) {
      // Draft cleanup is optional, don't fail the request
      console.warn('Could not clean up draft:', err);
    }

    return NextResponse.json({
      success: true,
      widget: {
        id: widget.id,
        name: widget.name,
        widget_type: widget.widget_type,
      },
    });
  } catch (error) {
    console.error('Widget from workflow error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
