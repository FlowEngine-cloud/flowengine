import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidUUID } from '@/lib/validation';

// GET /api/public/widget/[id] - Get component config for public rendering
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid widget ID' }, { status: 400 });
    }

    // Fetch the client_widget with instance info for validation
    const { data: widget, error } = await supabaseAdmin
      .from('client_widgets')
      .select('id, name, widget_type, form_fields, chatbot_config, webhook_url, is_active, styles, user_id, instance_id')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('Widget fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch widget' }, { status: 500 });
    }

    if (!widget) {
      return NextResponse.json({ error: 'Widget not found' }, { status: 404 });
    }

    if (!widget.is_active) {
      // Allow authenticated owners to preview their own draft components
      const authHeader = request.headers.get('Authorization');
      let isOwner = false;
      if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user?.id === widget.user_id) {
          isOwner = true;
        }
      }
      if (!isOwner) {
        return NextResponse.json({ error: 'Widget is disabled' }, { status: 403 });
      }
    }

    // Determine if widget has a connected workflow
    let hasWorkflow = !!(widget.webhook_url && widget.instance_id);

    // If instance_id exists, validate it's still valid
    if (widget.instance_id) {
      const { data: instance } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, deleted_at, subscription_status')
        .eq('id', widget.instance_id)
        .maybeSingle();

      if (!instance || instance.deleted_at) {
        hasWorkflow = false;
      } else if (instance.subscription_status !== 'active' && instance.subscription_status !== 'trialing') {
        hasWorkflow = false;
      }
    }

    // Fetch owner's tier and agency logo
    let ownerTier: string | null = null;
    let agencyLogoUrl: string | null = null;
    if (widget.user_id) {
      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('tier, agency_logo_url')
        .eq('id', widget.user_id)
        .maybeSingle();
      ownerTier = profile?.tier || null;
      if (ownerTier === 'pro_plus') {
        agencyLogoUrl = profile?.agency_logo_url || null;
      }
    }
    const canHideWatermark = ownerTier === 'pro_plus';

    // SECURITY: Never expose webhook_url publicly
    return NextResponse.json({
      widget: {
        id: widget.id,
        name: widget.name,
        type: widget.widget_type,
        fields: widget.form_fields || [],
        chatbotConfig: widget.chatbot_config || null,
        styles: widget.styles || null,
        canHideWatermark,
        agencyLogoUrl,
        hasWorkflow,
      },
    });
  } catch (error) {
    console.error('Public widget fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
