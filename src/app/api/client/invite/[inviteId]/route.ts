import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// PATCH: Add an instance to a pending invite (pre-assign before client accepts)
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { inviteId } = await params;

    if (!isValidUUID(inviteId)) {
      return NextResponse.json({ error: 'Invalid invite ID format' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const { instance_id } = await req.json();
    if (!instance_id || !isValidUUID(instance_id)) {
      return NextResponse.json({ error: 'Valid instance_id required' }, { status: 400 });
    }

    // Fetch invite — verify ownership and that it's still pending or name-only
    const { data: invite } = await supabaseAdmin
      .from('client_invites')
      .select('id, status, invited_by, accepted_by, instance_id, linked_instance_ids')
      .eq('id', inviteId)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invite.invited_by !== effectiveUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Allow pre-assign for pending invites OR accepted name-only clients (no real auth account)
    const isNameOnly = invite.status === 'accepted' && !invite.accepted_by;
    if (invite.status !== 'pending' && !isNameOnly) {
      return NextResponse.json({ error: 'Can only pre-assign instances to pending invites' }, { status: 400 });
    }

    // Verify the agency owns or manages this instance
    const { data: inst } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id')
      .eq('id', instance_id)
      .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
      .is('deleted_at', null)
      .maybeSingle();

    if (!inst) {
      return NextResponse.json({ error: 'Instance not found or access denied' }, { status: 403 });
    }

    // Accumulate instance IDs in linked_instance_ids (deduped)
    const existing: string[] = invite.linked_instance_ids || [];
    if (invite.instance_id && !existing.includes(invite.instance_id)) {
      existing.unshift(invite.instance_id);
    }
    const updated = [...new Set([...existing, instance_id])];

    const { error: updateError } = await supabaseAdmin
      .from('client_invites')
      .update({ linked_instance_ids: updated })
      .eq('id', inviteId);

    if (updateError) {
      console.error('Failed to pre-assign instance to invite:', updateError);
      return NextResponse.json({ error: 'Failed to pre-assign instance' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Invite PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ inviteId: string }> }
) {
  try {
    const { inviteId } = await params;

    // Validate UUID format
    if (!isValidUUID(inviteId)) {
      return NextResponse.json({ error: 'Invalid invite ID format' }, { status: 400 });
    }

    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify the user's session
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Fetch the invite to verify ownership and status
    const { data: invite } = await supabaseAdmin
      .from('client_invites')
      .select('id, status, invited_by')
      .eq('id', inviteId)
      .maybeSingle();

    if (!invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    // Verify the user owns this invite
    if (invite.invited_by !== effectiveUserId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Don't allow deleting accepted invites (they have active instances)
    // Revoked invites can be deleted since access was already revoked
    if (invite.status === 'accepted') {
      return NextResponse.json(
        { error: 'Cannot delete an accepted invitation. Use "Revoke Access" first to remove the client.' },
        { status: 400 }
      );
    }

    // Delete the invite
    const { error: deleteError } = await supabaseAdmin
      .from('client_invites')
      .delete()
      .eq('id', inviteId);

    if (deleteError) {
      console.error('Failed to delete invite:', deleteError);
      return NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
