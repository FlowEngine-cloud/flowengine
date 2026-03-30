import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, checkRateLimit, validateAndSanitizeCSS } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// Draft names start with this prefix to identify them
const DRAFT_PREFIX = '__DRAFT__';

// GET /api/widget-studio/draft - Get user's draft by ID or most recent
export async function GET(request: NextRequest) {
  try {
    // Authenticate user via Bearer token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ draft: null });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ draft: null });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Check for specific draft ID in query params
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('id');

    // Validate UUID format if draftId provided
    if (draftId && !isValidUUID(draftId)) {
      return NextResponse.json({ draft: null });
    }

    let draft;

    if (draftId) {
      // Load specific draft by ID
      const { data } = await supabaseAdmin
        .from('client_widgets')
        .select('id, widget_type, chatbot_config, form_fields, styles, webhook_url, created_at, updated_at')
        .eq('id', draftId)
        .eq('user_id', effectiveUserId)
        .eq('is_active', false)
        .maybeSingle();
      draft = data;
    } else {
      // Load most recent draft (for backwards compatibility)
      const { data } = await supabaseAdmin
        .from('client_widgets')
        .select('id, widget_type, chatbot_config, form_fields, styles, webhook_url, created_at, updated_at')
        .eq('user_id', effectiveUserId)
        .like('name', `${DRAFT_PREFIX}%`)
        .eq('is_active', false)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      draft = data;
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error('Draft GET error:', error);
    return NextResponse.json({ draft: null });
  }
}

// POST /api/widget-studio/draft - Create or update draft
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

    const body = await request.json();
    const { widget_type = 'chatbot', chatbot_config, form_fields, styles, webhook_url, draftId } = body;

    // Validate component type
    if (!['chatbot', 'form', 'button'].includes(widget_type)) {
      return NextResponse.json({ error: 'Invalid component type' }, { status: 400 });
    }

    // Require config based on component type
    if (widget_type === 'chatbot' && !chatbot_config) {
      return NextResponse.json({ error: 'Chatbot config required' }, { status: 400 });
    }
    if (widget_type === 'form' && (!form_fields || !Array.isArray(form_fields))) {
      return NextResponse.json({ error: 'Form fields required' }, { status: 400 });
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

    // If draftId is provided, UPDATE existing draft (no limit check needed)
    if (draftId) {
      // Validate UUID format
      if (!isValidUUID(draftId)) {
        return NextResponse.json({ error: 'Invalid draft ID format' }, { status: 400 });
      }

      const { data: updatedDraft, error: updateError } = await supabaseAdmin
        .from('client_widgets')
        .update({
          widget_type,
          chatbot_config: widget_type === 'chatbot' ? chatbot_config : null,
          form_fields: widget_type === 'form' ? form_fields : null,
          styles: styles || {},
          webhook_url: webhook_url || '',
          updated_at: new Date().toISOString(),
        })
        .eq('id', draftId)
        .eq('user_id', effectiveUserId)
        .like('name', `${DRAFT_PREFIX}%`)
        .eq('is_active', false)
        .select()
        .single();

      if (updateError) {
        console.error('Draft update error:', updateError);
        return NextResponse.json({ error: 'Failed to update draft' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        draft: updatedDraft,
        draftId: updatedDraft.id,
      });
    }

    // No draftId - CREATE new draft, check rate limit
    // Rate limit: max 10 draft creations per minute per user
    const rateLimitResult = checkRateLimit(`draft-create:${user.id}`, 10, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many drafts created. Please wait a moment.' },
        { status: 429 }
      );
    }

    // Create new draft with unique name
    const draftName = `${DRAFT_PREFIX}${crypto.randomUUID()}`;

    const { data: draft, error: insertError } = await supabaseAdmin
      .from('client_widgets')
      .insert({
        user_id: effectiveUserId,
        created_by: user.id,
        name: draftName,
        widget_type,
        chatbot_config: widget_type === 'chatbot' ? chatbot_config : null,
        form_fields: widget_type === 'form' ? form_fields : null,
        styles: styles || {},
        webhook_url: webhook_url || '',
        is_active: false, // Draft = inactive
      })
      .select()
      .single();

    if (insertError) {
      console.error('Draft save error:', insertError);
      return NextResponse.json({ error: 'Failed to save draft' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      draft,
      draftId: draft.id, // Return ID explicitly for easy access
    });
  } catch (error) {
    console.error('Draft POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/widget-studio/draft - Delete draft by ID or all drafts
export async function DELETE(request: NextRequest) {
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

    // Get query params
    const { searchParams } = new URL(request.url);
    const draftId = searchParams.get('id');
    const deleteAll = searchParams.get('all') === 'true';

    // Delete all drafts for the user
    if (deleteAll) {
      const { data: deletedDrafts, error: deleteError } = await supabaseAdmin
        .from('client_widgets')
        .delete()
        .eq('user_id', effectiveUserId)
        .like('name', `${DRAFT_PREFIX}%`)
        .eq('is_active', false)
        .select('id');

      if (deleteError) {
        console.error('Delete all drafts error:', deleteError);
        return NextResponse.json({ error: 'Failed to delete drafts' }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        deleted: deletedDrafts?.length || 0
      });
    }

    // Delete specific draft by ID
    if (!draftId) {
      return NextResponse.json({ error: 'Draft ID required' }, { status: 400 });
    }

    // Validate UUID format
    if (!isValidUUID(draftId)) {
      return NextResponse.json({ error: 'Invalid draft ID format' }, { status: 400 });
    }

    // Delete specific draft by ID (must be owned by user and be a draft)
    const { error: deleteError } = await supabaseAdmin
      .from('client_widgets')
      .delete()
      .eq('id', draftId)
      .eq('user_id', effectiveUserId)
      .like('name', `${DRAFT_PREFIX}%`)
      .eq('is_active', false);

    if (deleteError) {
      console.error('Draft delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete draft' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Draft DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
