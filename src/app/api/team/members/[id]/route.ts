import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveOwnerId, canManageTeam } from '@/lib/teamUtils';
import { isValidUUID } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// DELETE: Remove a team member
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);
    if (!canManageTeam(ctx.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('team_members')
      .update({ status: 'removed' })
      .eq('id', id)
      .eq('owner_id', ctx.ownerId);

    if (error) {
      console.error('Remove team member error:', error);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Team member DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update role
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

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

    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);
    if (!canManageTeam(ctx.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { role } = await req.json();
    const validRoles = ['member', 'manager', 'admin'];
    if (!validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('team_members')
      .update({ role })
      .eq('id', id)
      .eq('owner_id', ctx.ownerId);

    if (error) {
      console.error('Update team member role error:', error);
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Team member PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
