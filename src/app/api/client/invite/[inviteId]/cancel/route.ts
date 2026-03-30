import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Cancel a pending invite
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { inviteId } = await params;

    // Validate UUID format to prevent injection
    if (!isValidUUID(inviteId)) {
      return NextResponse.json({ error: 'Invalid invite ID' }, { status: 400 });
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

    console.log('[cancel-invite] User:', user.id, 'effectiveUserId:', effectiveUserId, 'attempting to cancel invite:', inviteId);

    // Get the invite
    const { data: invite, error: fetchError } = await supabaseAdmin
      .from('client_invites')
      .select('id, invited_by, email, status, instance_id')
      .eq('id', inviteId)
      .maybeSingle();

    if (fetchError || !invite) {
      console.error('[cancel-invite] Invite not found:', fetchError);
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    console.log('[cancel-invite] Found invite:', {
      id: invite.id,
      invited_by: invite.invited_by,
      email: invite.email,
      status: invite.status,
      instance_id: invite.instance_id,
    });

    // Check if user has permission to cancel this invite
    // User must be the one who sent the invite (invited_by)
    if (invite.invited_by !== effectiveUserId) {
      console.error('[cancel-invite] User is not the inviter');
      return NextResponse.json({ error: 'You do not have permission to cancel this invite' }, { status: 403 });
    }

    // Can cancel pending invites, or "accepted" invites that are in an inconsistent state
    // (accepted status but no agency access on the instance)
    if (invite.status !== 'pending' && invite.status !== 'accepted') {
      console.error('[cancel-invite] Invite cannot be cancelled, status:', invite.status);
      return NextResponse.json({ error: `Cannot cancel invite with status: ${invite.status}` }, { status: 400 });
    }

    // For "accepted" invites, check if we need to also revoke instance access
    if (invite.status === 'accepted' && invite.instance_id) {
      // Check if the instance has this agency set
      const { data: instance } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, invited_by_user_id')
        .eq('id', invite.instance_id)
        .maybeSingle();

      // If instance has invited_by_user_id set, clear it
      // (This is the user-invites-agency flow)
      if (instance?.invited_by_user_id) {
        console.log('[cancel-invite] Clearing agency access from instance:', instance.id);
        const { error: updateError } = await supabaseAdmin
          .from('pay_per_instance_deployments')
          .update({ invited_by_user_id: null })
          .eq('id', instance.id)
          .eq('user_id', effectiveUserId); // Security: only owner can revoke

        if (updateError) {
          console.error('[cancel-invite] Failed to clear instance access:', updateError);
          // Continue anyway - we still want to update the invite status
        }
      }
    }

    // Delete the invite (database constraint doesn't allow 'revoked' status)
    const { error: deleteError } = await supabaseAdmin
      .from('client_invites')
      .delete()
      .eq('id', inviteId);

    if (deleteError) {
      console.error('[cancel-invite] Failed to delete invite:', deleteError);
      return NextResponse.json({ error: 'Failed to cancel invite' }, { status: 500 });
    }

    console.log('[cancel-invite] Successfully deleted invite:', inviteId);

    return NextResponse.json({
      success: true,
      message: 'Invite cancelled successfully',
    });
  } catch (error) {
    console.error('[cancel-invite] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
