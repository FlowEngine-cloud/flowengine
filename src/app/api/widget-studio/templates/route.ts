import { NextRequest, NextResponse } from 'next/server';
import { isValidWebhookUrl, sanitizeString, checkRateLimit, validateAndSanitizeCSS } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET /api/widget-studio/templates - List user's templates
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Check for instance filter
    const instanceId = request.nextUrl.searchParams.get('instance_id');

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
      // Instances where user is a client (has been invited to)
      supabaseAdmin
        .from('client_instances')
        .select('instance_id')
        .eq('user_id', effectiveUserId),
    ]);

    const ownedInstanceIds = userInstances?.map(i => i.id) || [];
    const agencyInstanceIds = agencyInstances?.map(i => i.instance_id) || [];
    const clientInstanceIds = clientAccessInstances?.map(i => i.instance_id) || [];
    const allInstanceIds = [...new Set([...ownedInstanceIds, ...agencyInstanceIds, ...clientInstanceIds])];

    // Fetch widgets: either owned by user directly (user_id) or via instance (owned or agency)
    // Exclude drafts (UI components with __DRAFT__ prefix in name)
    let query = supabaseAdmin
      .from('client_widgets')
      .select(`
        *,
        instance:pay_per_instance_deployments(id, instance_name, user_id)
      `)
      .not('name', 'like', '__DRAFT__%')
      .order('created_at', { ascending: false });

    if (instanceId) {
      // Filter by specific instance - verify user has access
      if (!allInstanceIds.includes(instanceId)) {
        return NextResponse.json({ error: 'Access denied to this instance' }, { status: 403 });
      }
      query = query.eq('instance_id', instanceId);
    } else if (allInstanceIds.length > 0) {
      // Show all user's widgets: owned directly OR via instance (owned or agency)
      query = query.or(`user_id.eq.${effectiveUserId},instance_id.in.(${allInstanceIds.join(',')})`);
    } else {
      // User has no instances, only show directly owned widgets
      query = query.eq('user_id', effectiveUserId);
    }

    const { data: templates, error } = await query;

    if (error) {
      console.error('Error fetching templates:', error);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Templates GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/widget-studio/templates - Create a new template
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Rate limiting: 10 widget creations per minute per user
    const rateLimitResult = checkRateLimit(`widget-create:${user.id}`, 10, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many widget creations. Please wait a moment.' },
        { status: 429 }
      );
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const body = await request.json();
    const { name, description, widget_type, form_fields, chatbot_config, webhook_url, instance_id, styles, is_active } = body;

    // Validate and sanitize name
    const sanitizedName = sanitizeString(name, 100);
    if (!sanitizedName) {
      return NextResponse.json({ error: 'Component name is required' }, { status: 400 });
    }

    if (!widget_type || !['button', 'form', 'chatbot'].includes(widget_type)) {
      return NextResponse.json({ error: 'component type must be "button", "form", or "chatbot"' }, { status: 400 });
    }

    // If instance_id provided, verify user has access (owner or agency) and validate webhook URL
    let instanceUrl: string | undefined;
    if (instance_id) {
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
      instanceUrl = instance.instance_url;
    }

    // Validate webhook URL if provided with an instance (SSRF prevention)
    // Only validate if it looks like a URL or path (starts with http or /)
    let finalWebhookUrl = webhook_url?.trim() || '';
    if (finalWebhookUrl && instanceUrl) {
      const looksLikeUrl = finalWebhookUrl.startsWith('http') || finalWebhookUrl.startsWith('/');
      if (looksLikeUrl) {
        // If user entered a relative path (e.g., /webhook/abc), prepend the instance URL
        if (finalWebhookUrl.startsWith('/')) {
          try {
            const instanceUrlObj = new URL(instanceUrl);
            finalWebhookUrl = `${instanceUrlObj.origin}${finalWebhookUrl}`;
          } catch {
            return NextResponse.json({ error: 'Invalid instance URL configuration' }, { status: 400 });
          }
        }
        const webhookValidation = isValidWebhookUrl(finalWebhookUrl, instanceUrl);
        if (!webhookValidation.valid) {
          return NextResponse.json({ error: webhookValidation.error }, { status: 400 });
        }
      } else {
        // Clear invalid webhook URLs
        finalWebhookUrl = '';
      }
    }

    // Validate form fields for form components
    if (widget_type === 'form') {
      if (!form_fields || !Array.isArray(form_fields) || form_fields.length === 0) {
        return NextResponse.json({ error: 'form components require at least one field' }, { status: 400 });
      }

      // Limit form fields to prevent abuse
      if (form_fields.length > 50) {
        return NextResponse.json({ error: 'Maximum 50 form fields allowed' }, { status: 400 });
      }

      // Validate each form field
      for (const field of form_fields) {
        if (!field.name || typeof field.name !== 'string') {
          return NextResponse.json({ error: 'Each form field must have a name' }, { status: 400 });
        }
        // Sanitize field name to prevent XSS
        field.name = sanitizeString(field.name, 100);
        const validTypes = ['text', 'email', 'number', 'textarea', 'select', 'date', 'time', 'file', 'checkbox', 'radio', 'phone', 'url'];
        if (!field.type || !validTypes.includes(field.type)) {
          return NextResponse.json({ error: 'Invalid field type' }, { status: 400 });
        }
      }
    }

    // SECURITY: Sanitize custom CSS from chatbot_config and styles
    if (chatbot_config?.customCSS) {
      const cssResult = validateAndSanitizeCSS(chatbot_config.customCSS, 10000);
      if (!cssResult.valid) {
        return NextResponse.json({ error: cssResult.error }, { status: 400 });
      }
      chatbot_config.customCSS = cssResult.sanitized;
    }
    if (styles?.customCSS) {
      const cssResult = validateAndSanitizeCSS(styles.customCSS, 10000);
      if (!cssResult.valid) {
        return NextResponse.json({ error: cssResult.error }, { status: 400 });
      }
      styles.customCSS = cssResult.sanitized;
    }

    // create component in client_UI Components table (same as client-panel)
    const { data: template, error } = await supabaseAdmin
      .from('client_widgets')
      .insert({
        user_id: effectiveUserId,
        created_by: user.id,
        instance_id: instance_id || null,
        name: sanitizedName,
        widget_type,
        form_fields: widget_type === 'form' ? form_fields : null,
        chatbot_config: widget_type === 'chatbot' ? chatbot_config : null,
        webhook_url: finalWebhookUrl,
        styles: styles || {},
        is_active: is_active ?? false, // Default to draft mode if not specified
      })
      .select(`
        *,
        instance:pay_per_instance_deployments(id, instance_name, user_id)
      `)
      .single();

    if (error) {
      console.error('[Templates API] Error creating widget:', error);
      return NextResponse.json({ error: 'Failed to create template', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (error) {
    console.error('Templates POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
