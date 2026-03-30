import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { emailService } from '@/lib/emailService';
import { checkRateLimit, isValidEmail } from '@/lib/validation';
import { buildAppUrl } from '@/lib/config';
import { getEffectiveOwnerId, canManageTeam } from '@/lib/teamUtils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


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

    // Rate limit: 10 invites per hour
    const rl = checkRateLimit(`team-invite:${user.id}`, 10, 60 * 60 * 1000);
    if (!rl.allowed) {
      return NextResponse.json({ error: 'Too many invitations. Try again later.' }, { status: 429 });
    }

    // Resolve team context — admins of an existing team can also invite
    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);
    const effectiveOwnerId = ctx.ownerId;

    // Check: only owners and admins can invite team members
    if (!canManageTeam(ctx.role)) {
      return NextResponse.json({ error: 'You do not have permission to invite team members' }, { status: 403 });
    }

    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', effectiveOwnerId)
      .single();

    const { email, role } = await req.json();

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate role
    const validRoles = ['member', 'manager', 'admin'];
    if (role && !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
    }

    // Prevent self-invite
    if (normalizedEmail === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
    }

    // Prevent inviting the team owner (if an admin is inviting)
    if (ctx.isTeamMember) {
      const { data: ownerAuth } = await supabaseAdmin.auth.admin.getUserById(effectiveOwnerId);
      if (ownerAuth?.user?.email?.toLowerCase() === normalizedEmail) {
        return NextResponse.json({ error: 'This person is already the team owner' }, { status: 400 });
      }
    }

    // Check if already invited
    const { data: existing } = await supabaseAdmin
      .from('team_members')
      .select('id, status')
      .eq('owner_id', effectiveOwnerId)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existing && existing.status !== 'removed') {
      return NextResponse.json({ error: 'This email has already been invited' }, { status: 409 });
    }

    const token = `tm_${randomBytes(24).toString('hex')}`;

    // Upsert (re-invite removed members)
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
        owner_id: effectiveOwnerId,
        email: normalizedEmail,
        role: role || 'member',
        token,
      });

      if (insertError) {
        console.error('Team invite insert error:', insertError);
        return NextResponse.json({ error: `Failed to create invitation: ${insertError.message}` }, { status: 500 });
      }
    }

    // Send invite email
    const inviteUrl = buildAppUrl(`/invite/accept-team?token=${token}`);
    const ownerName = ownerProfile?.full_name || 'Your team';

    let emailSent = false;
    try {
      await emailService.sendTeamMemberInvite(normalizedEmail, ownerName, role || 'member', inviteUrl);
      emailSent = true;
    } catch (emailErr) {
      console.error('Failed to send team invite email:', emailErr);
      // Don't fail the invite if email fails — the token still works
    }

    return NextResponse.json({ success: true, emailSent });
  } catch (error) {
    console.error('Team invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
