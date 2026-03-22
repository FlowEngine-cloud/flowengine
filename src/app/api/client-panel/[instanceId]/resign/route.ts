import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Agency resigns from managing a client's instance
// This handles both:
// - Flow 2: Agency invited client, client pays (client owns instance, agency manages)
// - Flow 3: Client invited agency (client owns instance, agency accepted invite)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const { instanceId } = await params;

    // Validate UUID format
    if (!isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Invalid instance ID format' }, { status: 400 });
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

    // Rate limit: 10 resignations per hour
    const rateLimitResult = checkRateLimit(`resign:${user.id}`, 10, 60 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    // Verify this agency is the manager (invited_by_user_id) and NOT the owner
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, invited_by_user_id')
      .eq('id', instanceId)
      .eq('invited_by_user_id', effectiveUserId)
      .neq('user_id', effectiveUserId) // Must not be owner (client owns it)
      .maybeSingle();

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or you are not the manager' }, { status: 403 });
    }

    // delete components created by the agency for this instance
    const { error: widgetDeleteError } = await supabaseAdmin
      .from('client_widgets')
      .delete()
      .eq('instance_id', instanceId)
      .eq('created_by', effectiveUserId);

    if (widgetDeleteError) {
      console.error('Failed to delete agency widgets:', widgetDeleteError);
      // Continue anyway - UI components are not critical
    }

    // Remove agency's widget category for this instance
    const { error: categoryDeleteError } = await supabaseAdmin
      .from('widget_categories')
      .delete()
      .eq('instance_id', instanceId)
      .eq('user_id', effectiveUserId);

    if (categoryDeleteError) {
      console.error('Failed to delete component category:', categoryDeleteError);
    }

    // Delete the invite - handle both flows:
    // Flow 2 (agency invited client, client pays): invited_by = agency, accepted_by = client
    // Flow 3 (client invited agency): invited_by = client, accepted_by = agency

    // For Flow 3: delete by accepted_by = agency (agency accepted the invite)
    const { error: deleteInviteByAcceptedError } = await supabaseAdmin
      .from('client_invites')
      .delete()
      .eq('instance_id', instanceId)
      .eq('accepted_by', effectiveUserId);

    if (deleteInviteByAcceptedError) {
      console.error('Failed to remove invite by accepted_by:', deleteInviteByAcceptedError);
    }

    // For Flow 2: delete by invited_by = agency AND accepted_by = client (instance owner)
    // The invite has instance_id = null in Flow 2, so we match by accepted_by = instance owner
    const { error: deleteInviteByInvitedError } = await supabaseAdmin
      .from('client_invites')
      .delete()
      .eq('invited_by', effectiveUserId)
      .eq('accepted_by', instance.user_id)
      .is('instance_id', null); // Flow 2 invites have null instance_id

    if (deleteInviteByInvitedError) {
      console.error('Failed to remove invite by invited_by:', deleteInviteByInvitedError);
    }

    // Remove agency as manager from the instance
    const { error: updateError } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .update({ invited_by_user_id: null })
      .eq('id', instanceId)
      .eq('invited_by_user_id', effectiveUserId);

    if (updateError) {
      console.error('Failed to remove agency from instance:', updateError);
      return NextResponse.json({ error: 'Failed to resign from instance' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resign error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
