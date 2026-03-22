import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { emailService } from '@/lib/emailService';
import { checkRateLimit, isValidEmail } from '@/lib/validation';
import { buildAppUrl } from '@/lib/config';
import { getEffectiveOwnerId, canManageTeam } from '@/lib/teamUtils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


/**
 * Verify the caller (agency) has a client relationship with the given clientUserId.
 * Returns true if the agency owns at least one instance linked to this client.
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
 * Verify the client belongs to at least one agency (has instances assigned by an agency).
 * This ensures random free users can't use this endpoint to get free team members.
 */
async function verifyClientHasAgency(clientUserId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id')
    .eq('user_id', clientUserId)
    .limit(1);
  return (data && data.length > 0) || false;
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

    // Resolve caller's team context
    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);

    // Verify agency-client relationship
    const isAgency = await verifyAgencyClientRelation(ctx.ownerId, clientUserId);
    // Also allow if the caller IS the client AND they belong to an agency
    const isClient = user.id === clientUserId;
    const clientHasAgency = isClient ? await verifyClientHasAgency(clientUserId) : false;

    if (!isAgency && !(isClient && clientHasAgency)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { data: members, error } = await supabaseAdmin
      .from('team_members')
      .select('id, email, role, status, invited_at, accepted_at')
      .eq('owner_id', clientUserId)
      .neq('status', 'removed')
      .order('invited_at', { ascending: false });

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

    // Resolve caller's team context
    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);

    // Verify agency-client relationship
    const isAgency = await verifyAgencyClientRelation(ctx.ownerId, clientId);
    const isClient = user.id === clientId;
    const clientHasAgency = isClient ? await verifyClientHasAgency(clientId) : false;

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

    // Prevent inviting the client themselves
    const { data: clientAuth } = await supabaseAdmin.auth.admin.getUserById(clientId);
    if (clientAuth?.user?.email?.toLowerCase() === normalizedEmail) {
      return NextResponse.json({ error: 'Cannot invite the account owner' }, { status: 400 });
    }

    // Check if already invited
    const { data: existing } = await supabaseAdmin
      .from('team_members')
      .select('id, status')
      .eq('owner_id', clientId)
      .eq('email', normalizedEmail)
      .maybeSingle();

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
      const { error: insertError } = await supabaseAdmin.from('team_members').insert({
        owner_id: clientId,
        email: normalizedEmail,
        role: role || 'member',
        token,
      });

      if (insertError) {
        console.error('Client team invite insert error:', insertError);
        return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
      }
    }

    // Send invite email
    const inviteUrl = buildAppUrl(`/invite/accept-team?token=${token}`);
    const { data: clientProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', clientId)
      .single();

    const ownerName = clientProfile?.full_name || 'Your team';

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
