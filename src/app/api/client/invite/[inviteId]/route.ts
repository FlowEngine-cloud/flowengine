import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


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
