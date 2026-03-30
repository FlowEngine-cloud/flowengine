import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { emailService } from '@/lib/emailService';
import { checkRateLimit, isValidEmail, isValidUUID } from '@/lib/validation';
import { buildAppUrl } from '@/lib/config';
import { getEffectiveOwnerId, canManageTeam } from '@/lib/teamUtils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


/**
 * Verify the caller (agency) has a client relationship with the given clientUserId.
 *
 * clientUserId can be:
 *   - A real UUID (accepted client with Supabase auth account) — check client_invites.accepted_by
 *   - "ni_{inviteId}" (name-only client, no auth account) — check client_invites.id
 *   - "pending:{inviteId}" (pending invite) — check client_invites.id
 */
async function verifyAgencyClientRelation(agencyOwnerId: string, clientUserId: string): Promise<boolean> {
  // Prefixed IDs (ni_{inviteId} or pending:{inviteId}) — both map to a client_invites row
  for (const prefix of ['ni_', 'pending:']) {
    if (clientUserId.startsWith(prefix)) {
      const inviteId = clientUserId.slice(prefix.length);
      const { data } = await supabaseAdmin
        .from('client_invites')
        .select('id')
        .eq('id', inviteId)
        .eq('invited_by', agencyOwnerId)
        .maybeSingle();
      return !!data;
    }
  }

  // Real client UUID: check client_invites.accepted_by or client_instances.user_id
  const [{ data: invite }, { data: ci }, { data: inst }] = await Promise.all([
    supabaseAdmin
      .from('client_invites')
      .select('id')
      .eq('accepted_by', clientUserId)
      .eq('invited_by', agencyOwnerId)
      .maybeSingle(),
    supabaseAdmin
      .from('client_instances')
      .select('id')
      .eq('user_id', clientUserId)
      .eq('invited_by', agencyOwnerId)
      .maybeSingle(),
    // Legacy: also check pay_per_instance_deployments.client_id (set by Stripe webhook)
    supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id')
      .eq('user_id', agencyOwnerId)
      .eq('client_id', clientUserId)
      .limit(1)
      .maybeSingle(),
  ]);
  return !!(invite || ci || inst);
}

/**
 * Verify the client belongs to at least one agency.
 */
async function verifyClientHasAgency(clientUserId: string): Promise<boolean> {
  const [{ data: ci }, { data: inv }, { data: inst }] = await Promise.all([
    supabaseAdmin
      .from('client_instances')
      .select('id')
      .eq('user_id', clientUserId)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('client_invites')
      .select('id')
      .eq('accepted_by', clientUserId)
      .limit(1)
      .maybeSingle(),
    supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id')
      .eq('client_id', clientUserId)
      .limit(1)
      .maybeSingle(),
  ]);
  return !!(ci || inv || inst);
}

// GET: List team members for a client
export async function GET(req: NextRequest) {
  try {
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

    const clientUserId = req.nextUrl.searchParams.get('clientId');
    if (!clientUserId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    const isPendingClient = clientUserId.startsWith('pending:');
    const pendingInviteId = isPendingClient ? clientUserId.slice('pending:'.length) : null;

    if (!isPendingClient && !isValidUUID(clientUserId)) {
      return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });
    }

    // Resolve caller's team context
    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);

    const isClient = user.id === clientUserId;
    const [isAgency, clientHasAgency] = await Promise.all([
      verifyAgencyClientRelation(ctx.ownerId, clientUserId),
      isClient ? verifyClientHasAgency(clientUserId) : Promise.resolve(false),
    ]);

    if (!isAgency && !(isClient && clientHasAgency)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const baseMembersQuery = supabaseAdmin
      .from('team_members')
      .select('id, email, role, status, invited_at, accepted_at')
      .neq('status', 'removed')
      .order('invited_at', { ascending: false });

    const { data: members, error } = await (isPendingClient
      ? baseMembersQuery.eq('pending_client_invite_id', pendingInviteId)
      : baseMembersQuery.eq('owner_id', clientUserId));

    if (error) {
      console.error('List client team members error:', error);
      return NextResponse.json({ error: 'Failed to load team members' }, { status: 500 });
    }

    return NextResponse.json({ members: members || [] });
  } catch (error) {
    console.error('Client team members GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Invite a team member for a client
export async function POST(req: NextRequest) {
  try {
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

    // Rate limit
    const rl = checkRateLimit(`client-team-invite:${user.id}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many invitations. Try again later.' }, { status: 429 });
    }

    const { clientId, email, role } = await req.json();
    if (!clientId) {
      return NextResponse.json({ error: 'clientId is required' }, { status: 400 });
    }

    // ni_ (name-only) clients have no auth account and no email — team members can't log in
    if (clientId.startsWith('ni_')) {
      return NextResponse.json({ error: 'Name-only clients cannot have team members' }, { status: 400 });
    }

    const isPendingClient = clientId.startsWith('pending:');
    const pendingInviteId = isPendingClient ? clientId.slice('pending:'.length) : null;

    if (!isPendingClient && !isValidUUID(clientId)) {
      return NextResponse.json({ error: 'Invalid clientId' }, { status: 400 });
    }

    // Resolve caller's team context
    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);

    const isClient = user.id === clientId;
    const [isAgency, clientHasAgency] = await Promise.all([
      verifyAgencyClientRelation(ctx.ownerId, clientId),
      isClient ? verifyClientHasAgency(clientId) : Promise.resolve(false),
    ]);

    if (!isAgency && !(isClient && clientHasAgency)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // If agency is inviting, check they can manage team
    if (isAgency && !canManageTeam(ctx.role)) {
      return NextResponse.json({ error: 'You do not have permission to manage team members' }, { status: 403 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    const validRoles = ['member', 'manager', 'admin'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // For accepted clients: verify they have a real auth account and don't invite themselves
    if (!isPendingClient) {
      const { data: clientAuth } = await supabaseAdmin.auth.admin.getUserById(clientId);
      if (!clientAuth?.user) {
        return NextResponse.json({ error: 'Client must have an account before team members can be added' }, { status: 400 });
      }
      if (clientAuth.user.email?.toLowerCase() === normalizedEmail) {
        return NextResponse.json({ error: 'Cannot invite the account owner' }, { status: 400 });
      }
    }

    // Check if already invited
    const baseExistingQuery = supabaseAdmin
      .from('team_members')
      .select('id, status')
      .eq('email', normalizedEmail);

    const { data: existing } = await (isPendingClient
      ? baseExistingQuery.eq('pending_client_invite_id', pendingInviteId).maybeSingle()
      : baseExistingQuery.eq('owner_id', clientId).maybeSingle());

    if (existing && existing.status !== 'removed') {
      return NextResponse.json({ error: 'This email has already been invited' }, { status: 409 });
    }

    const token = `tm_${randomBytes(24).toString('hex')}`;

    if (existing?.status === 'removed') {
      await supabaseAdmin
        .from('team_members')
        .update({
          role: role || 'member',
          status: 'pending',
          token,
          member_id: null,
          accepted_at: null,
          invited_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      const insertData: Record<string, unknown> = {
        email: normalizedEmail,
        role: role || 'member',
        token,
      };
      if (isPendingClient) {
        insertData.pending_client_invite_id = pendingInviteId;
      } else {
        insertData.owner_id = clientId;
      }

      const { error: insertError } = await supabaseAdmin.from('team_members').insert(insertData);

      if (insertError) {
        console.error('Client team invite insert error:', insertError);
        return NextResponse.json({ error: `Failed to create invitation: ${insertError.message}` }, { status: 500 });
      }
    }

    // Send invite email
    const inviteUrl = buildAppUrl(`/invite/accept-team?token=${token}`);

    let ownerName = 'Your team';
    if (!isPendingClient) {
      const { data: clientProfile } = await supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', clientId)
        .single();
      ownerName = clientProfile?.full_name || 'Your team';
    }

    try {
      await emailService.sendTeamMemberInvite(normalizedEmail, ownerName, role || 'member', inviteUrl);
    } catch (emailErr) {
      console.error('Failed to send client team invite email:', emailErr);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Client team invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
