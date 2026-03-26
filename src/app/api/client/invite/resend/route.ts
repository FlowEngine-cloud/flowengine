import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { emailService, AgencySmtpConfig } from '@/lib/emailService';
import { buildAppUrl } from '@/lib/config';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Resend an invitation
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { inviteId } = await req.json();

    if (!inviteId) {
      return NextResponse.json({ error: 'Invite ID is required' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Validate UUID format
    if (!isValidUUID(inviteId)) {
      return NextResponse.json({ error: 'Invalid invite ID format' }, { status: 400 });
    }

    // Get the invite and user profile in parallel
    const [{ data: invite }, { data: profile }] = await Promise.all([
      supabaseAdmin
        .from('client_invites')
        .select('*')
        .eq('id', inviteId)
        .eq('invited_by', effectiveUserId)
        .maybeSingle(),
      supabaseAdmin
        .from('profiles')
        .select('full_name, agency_smtp_enabled, agency_smtp_host, agency_smtp_port, agency_smtp_user, agency_smtp_pass_encrypted, agency_smtp_sender')
        .eq('id', effectiveUserId)
        .maybeSingle(),
    ]);

    if (!invite) {
      return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    }

    // Check if invite was already accepted
    if (invite.status === 'accepted') {
      return NextResponse.json({ error: 'Invite was already accepted' }, { status: 400 });
    }

    // Generate new token and update expiry
    // Agency-paid (has instance_id) gets 30 days, client-paid gets 7 days
    const newToken = `ci_${randomBytes(24).toString('hex')}`;
    const expiryDays = invite.instance_id ? 30 : 7;
    const newExpiry = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000);

    const { error: updateError } = await supabaseAdmin
      .from('client_invites')
      .update({
        token: newToken,
        status: 'pending',
        expires_at: newExpiry.toISOString(),
      })
      .eq('id', inviteId);

    if (updateError) {
      console.error('Failed to update invite:', updateError);
      return NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 });
    }

    // Always use access-grant path (no payment/checkout needed in OSS)
    const inviteUrl = buildAppUrl(`/invite/accept-access?token=${newToken}`);
    const agencyName = profile?.full_name || 'Your agency';

    // Build agency SMTP config if enabled
    let agencySmtp: AgencySmtpConfig | undefined;
    if (profile?.agency_smtp_enabled && profile.agency_smtp_host && profile.agency_smtp_pass_encrypted) {
      agencySmtp = {
        host: profile.agency_smtp_host,
        port: profile.agency_smtp_port || 587,
        user: profile.agency_smtp_user || '',
        passEncrypted: profile.agency_smtp_pass_encrypted,
        sender: profile.agency_smtp_sender || '',
      };
    }

    try {
      await emailService.sendClientAccessGrant(
        invite.email,
        agencyName,
        inviteUrl,
        agencySmtp
      );
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Resend invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
