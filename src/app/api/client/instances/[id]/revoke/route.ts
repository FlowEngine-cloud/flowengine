import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Revoke agency access to an instance
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: instanceId } = await params;

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

    // Get the instance with invited_by_user_id
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, invited_by_user_id')
      .eq('id', instanceId)
      .maybeSingle();

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Verify the user is either:
    // 1. The instance owner (revoking agency access from their instance)
    // 2. The agency who was invited (agency removing themselves)
    const isOwner = instance.user_id === effectiveUserId;
    const isAgency = instance.invited_by_user_id === effectiveUserId;

    if (!isOwner && !isAgency) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if there's actually an agency to revoke
    if (!instance.invited_by_user_id) {
      return NextResponse.json({ error: 'No agency access to revoke' }, { status: 400 });
    }

    // Find the associated invite to update its status
    const { data: invite } = await supabaseAdmin
      .from('client_invites')
      .select('id')
      .eq('instance_id', instanceId)
      .eq('status', 'accepted')
      .maybeSingle();

    // Clear the invited_by_user_id (revokes access)
    const { error: updateError } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .update({ invited_by_user_id: null })
      .eq('id', instanceId);

    if (updateError) {
      console.error('Failed to revoke agency access:', updateError);
      return NextResponse.json({ error: 'Failed to revoke access' }, { status: 500 });
    }

    // Delete the invite (database constraint doesn't allow 'revoked' status)
    if (invite?.id) {
      const { error: inviteDeleteError } = await supabaseAdmin
        .from('client_invites')
        .delete()
        .eq('id', invite.id);

      if (inviteDeleteError) {
        // Log but don't fail - the access was already revoked
        console.error('Failed to delete invite:', inviteDeleteError);
      }
    }

    return NextResponse.json({
      success: true,
      revokedBy: isOwner ? 'owner' : 'agency',
    });
  } catch (error) {
    console.error('Revoke agency access error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
