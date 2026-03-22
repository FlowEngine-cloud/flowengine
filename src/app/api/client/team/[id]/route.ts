import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveOwnerId, canManageTeam } from '@/lib/teamUtils';
import { isValidUUID } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


/**
 * Verify the caller (agency) has a client relationship with the given clientUserId.
 */
async function verifyAgencyClientRelation(agencyOwnerId: string, clientUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id')
    .eq('owner_id', agencyOwnerId)
    .eq('user_id', clientUserId)
    .limit(1);
  return (data && data.length > 0) || false;
}

/**
 * Verify the client belongs to at least one agency.
 */
async function verifyClientHasAgency(clientUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id')
    .eq('user_id', clientUserId)
    .limit(1);
  return (data && data.length > 0) || false;
}

/**
 * Get the owner_id of a team_member record to verify the client relationship.
 */
async function getMemberOwnerId(memberId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('team_members')
    .select('owner_id')
    .eq('id', memberId)
    .maybeSingle();
  return data?.owner_id || null;
}

// DELETE: Remove a client's team member
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
    const memberOwnerId = await getMemberOwnerId(id);
    if (!memberOwnerId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Allow if caller is the client themselves (with agency) OR agency managing this client
    const isClient = user.id === memberOwnerId;
    const isAgency = await verifyAgencyClientRelation(ctx.ownerId, memberOwnerId);
    const clientHasAgency = isClient ? await verifyClientHasAgency(memberOwnerId) : false;

    if (!isAgency && !(isClient && clientHasAgency)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    if (isAgency && !canManageTeam(ctx.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { error } = await supabaseAdmin
      .from('team_members')
      .update({ status: 'removed' })
      .eq('id', id)
      .eq('owner_id', memberOwnerId);

    if (error) {
      console.error('Remove client team member error:', error);
      return NextResponse.json({ error: 'Failed to remove member' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Client team member DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update a client's team member role
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
    const memberOwnerId = await getMemberOwnerId(id);
    if (!memberOwnerId) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const isClient = user.id === memberOwnerId;
    const isAgency = await verifyAgencyClientRelation(ctx.ownerId, memberOwnerId);
    const clientHasAgency = isClient ? await verifyClientHasAgency(memberOwnerId) : false;

    if (!isAgency && !(isClient && clientHasAgency)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    if (isAgency && !canManageTeam(ctx.role)) {
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
      .eq('owner_id', memberOwnerId);

    if (error) {
      console.error('Update client team member role error:', error);
      return NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Client team member PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
