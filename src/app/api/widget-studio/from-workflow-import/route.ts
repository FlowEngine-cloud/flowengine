import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST /api/widget-studio/from-workflow-import - Save a component and link it to an imported workflow
// This is used when Pro+ users import a workflow and want to save the component linked to it
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

    // Parse request body
    const body = await request.json();
    const {
      name,
      widget_type = 'chatbot',
      chatbot_config,
      form_fields,
      styles,
      instance_id,
      workflow_id,
      workflow_name,
      workflow_json, // n8n workflow with webhookIds assigned after activation
    } = body;

    // Validate required fields
    if (!name?.trim()) {
      return NextResponse.json({ error: 'Component name is required' }, { status: 400 });
    }

    if (!instance_id || !isValidUUID(instance_id)) {
      return NextResponse.json({ error: 'Valid instance_id is required' }, { status: 400 });
    }

    // Validate component type
    if (!['chatbot', 'form', 'button'].includes(widget_type)) {
      return NextResponse.json({ error: 'Invalid component type' }, { status: 400 });
    }

    // Validate config based on component type
    if (widget_type === 'chatbot' && !chatbot_config) {
      return NextResponse.json({ error: 'Chatbot configuration is required' }, { status: 400 });
    }

    // Verify access to instance
    const [{ data: instance }, { data: clientInstance }] = await Promise.all([
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, user_id, instance_url')
        .eq('id', instance_id)
        .maybeSingle(),
      supabaseAdmin
        .from('client_instances')
        .select('user_id, invited_by')
        .eq('instance_id', instance_id)
        .or(`user_id.eq.${user.id},invited_by.eq.${user.id}`)
        .maybeSingle(),
    ]);

    // Verify user has access to the instance
    const isOwner = instance?.user_id === user.id;
    const hasClientAccess = !!clientInstance;

    if (!instance || (!isOwner && !hasClientAccess)) {
      return NextResponse.json(
        { error: 'Instance not found or access denied' },
        { status: 403 }
      );
    }

    // No watermark for open-source portal
    const showWatermark = false;

    // Merge watermark setting into chatbot config if applicable
    const finalChatbotConfig = widget_type === 'chatbot'
      ? { ...chatbot_config, showWatermark }
      : null;

    // Extract webhook URL from workflow based on component type
    // Chatbots use Chat Trigger: {instance_url}/webhook/{webhookId}/chat
    // Forms/Buttons use Webhook: {instance_url}/webhook/{path}
    let webhookUrl = '';
    let webhookUrlMissing = false;
    const instanceUrl = instance.instance_url?.replace(/\/$/, ''); // Remove trailing slash

    if (workflow_json && instanceUrl) {
      const nodes = workflow_json.nodes || [];

      if (widget_type === 'chatbot') {
        // Find Chat Trigger node - n8n assigns webhookId on activation
        const chatTrigger = nodes.find((node: any) =>
          node.type === '@n8n/n8n-nodes-langchain.chatTrigger' ||
          node.type?.includes('chatTrigger')
        );

        if (chatTrigger?.webhookId) {
          webhookUrl = `${instanceUrl}/webhook/${chatTrigger.webhookId}/chat`;
        } else if (chatTrigger) {
          // Chat Trigger exists but webhookId not yet assigned by n8n
          // This can happen due to n8n's async webhook registration
          // Save without webhook URL - user can sync it later in UI Studio
          console.warn('[from-workflow-import] Chat Trigger found but webhookId missing - saving without webhook URL');
          webhookUrlMissing = true;
        } else {
          // No Chat Trigger node at all
          console.warn('[from-workflow-import] No Chat Trigger found in workflow - saving without webhook URL');
          webhookUrlMissing = true;
        }
      } else {
        // Forms/Buttons use Webhook node with path parameter
        const webhookNode = nodes.find((node: any) =>
          node.type === 'n8n-nodes-base.webhook' ||
          node.type === 'n8n-nodes-base.formTrigger'
        );

        if (webhookNode) {
          const path = webhookNode.parameters?.path;
          if (path) {
            const isFormTrigger = webhookNode.type === 'n8n-nodes-base.formTrigger';
            webhookUrl = isFormTrigger
              ? `${instanceUrl}/webhook/${path}/n8n-form`
              : `${instanceUrl}/webhook/${path}`;
          } else {
            webhookUrlMissing = true;
          }
        } else {
          webhookUrlMissing = true;
        }
      }
    } else {
      webhookUrlMissing = true;
    }

    // Create the component with instance and workflow linkage
    const { data: widget, error: insertError } = await supabaseAdmin
      .from('client_widgets')
      .insert({
        name: name.trim(),
        widget_type,
        chatbot_config: finalChatbotConfig,
        form_fields: widget_type === 'form' ? form_fields : null,
        styles: styles || {},
        user_id: user.id,
        instance_id: instance_id,
        workflow_id: workflow_id || null,
        workflow_name: workflow_name || null,
        is_active: true,
        created_by: user.id,
        webhook_url: webhookUrl,
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

    // Auto-link to category when assigning to an instance
    // This ensures the widget shows up in filtered views
    if (instance_id) {
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
              user_id: user.id,
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
            .eq('widget_id', widget.id)
            .eq('category_id', categoryId)
            .maybeSingle();

          if (!existingLink) {
            await supabaseAdmin
              .from('widget_category_links')
              .insert({
                widget_id: widget.id,
                category_id: categoryId,
              });
          }
        }
      } catch (err) {
        // Category linking is optional - don't fail the request
        console.warn('Could not auto-link to category:', err);
      }
    }

    // Clean up any existing drafts for this user
    try {
      await supabaseAdmin
        .from('client_widgets')
        .delete()
        .eq('user_id', user.id)
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
        instance_id: widget.instance_id,
        workflow_id: widget.workflow_id,
        workflow_name: widget.workflow_name,
        webhook_url: webhookUrl || null,
      },
      webhookUrlMissing,
      message: webhookUrlMissing
        ? 'Component saved but webhook URL could not be extracted. You can sync it later in UI Studio.'
        : undefined,
    });
  } catch (error) {
    console.error('Widget from workflow import error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
