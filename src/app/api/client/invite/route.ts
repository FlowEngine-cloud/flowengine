import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { emailService, AgencySmtpConfig } from '@/lib/emailService';
import { checkRateLimit, isValidEmail, isValidUUID } from '@/lib/validation';
import { buildAppUrl } from '@/lib/config';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


export async function POST(req: NextRequest) {
  try {
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

    // Rate limiting: max 10 invites per hour per user
    const rateLimitResult = checkRateLimit(`invite:${user.id}`, 10, 60 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many invitations sent. Please try again later.' },
        { status: 429 }
      );
    }

    // Resolve effective user ID for team members
    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get profile of the effective user (team owner for team members)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('full_name, agency_smtp_enabled, agency_smtp_host, agency_smtp_port, agency_smtp_user, agency_smtp_pass_encrypted, agency_smtp_sender')
      .eq('id', effectiveUserId)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Parse request body
    const { email, existingInstanceId, existingInstanceIds, linkedServiceIds } = await req.json();

    // Validate email using robust validation (isValidEmail handles null/type checks)
    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // Prevent self-invites
    if (email.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
    }

    // Validate existingInstanceId format if provided
    if (existingInstanceId && !isValidUUID(existingInstanceId)) {
      return NextResponse.json({ error: 'Invalid instance ID format' }, { status: 400 });
    }

    // Validate existingInstanceIds array items if provided
    if (existingInstanceIds && Array.isArray(existingInstanceIds)) {
      for (const id of existingInstanceIds) {
        if (!isValidUUID(id)) {
          return NextResponse.json({ error: 'Invalid instance ID format in list' }, { status: 400 });
        }
      }
      // Verify all listed instances belong to this user (or team owner)
      if (existingInstanceIds.length > 0) {
        const { data: ownedInstances } = await supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('id')
          .in('id', existingInstanceIds)
          .eq('user_id', effectiveUserId)
          .is('deleted_at', null);

        const ownedIds = new Set((ownedInstances || []).map(i => i.id));
        const unauthorized = existingInstanceIds.filter(id => !ownedIds.has(id));
        if (unauthorized.length > 0) {
          return NextResponse.json({ error: 'One or more instances not found or access denied' }, { status: 403 });
        }
      }
    }

    // Validate linkedServiceIds array items if provided
    if (linkedServiceIds && Array.isArray(linkedServiceIds)) {
      for (const id of linkedServiceIds) {
        if (!isValidUUID(id)) {
          return NextResponse.json({ error: 'Invalid service ID format in list' }, { status: 400 });
        }
      }
      // Verify all listed services belong to this user (or team owner)
      if (linkedServiceIds.length > 0) {
        const { data: ownedServices } = await supabaseAdmin
          .from('whatsapp_instances')
          .select('id')
          .in('id', linkedServiceIds)
          .eq('user_id', effectiveUserId)
          .is('deleted_at', null);

        const ownedIds = new Set((ownedServices || []).map(s => s.id));
        const unauthorized = linkedServiceIds.filter((id: string) => !ownedIds.has(id));
        if (unauthorized.length > 0) {
          return NextResponse.json({ error: 'One or more services not found or access denied' }, { status: 403 });
        }
      }
    }

    // If an existing instance is specified, validate it belongs to this user
    let agencyInstance = null;

    if (existingInstanceId) {
      const { data: instance, error: instanceError } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, instance_name, storage_limit_gb, instance_url')
        .eq('id', existingInstanceId)
        .eq('user_id', effectiveUserId)
        .single();

      if (instanceError || !instance) {
        return NextResponse.json({ error: 'Instance not found or access denied' }, { status: 404 });
      }

      agencyInstance = instance;
    }

    // Check if an invite already exists for this email from this user (or team owner)
    const { data: existingInvite } = await supabaseAdmin
      .from('client_invites')
      .select('id, status')
      .eq('email', email.toLowerCase())
      .eq('invited_by', effectiveUserId)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email address' },
        { status: 400 }
      );
    }

    // Check if this email already has a pending invite from ANY agency
    // This prevents multiple agencies inviting the same person simultaneously
    const { data: existingInviteFromOthers } = await supabaseAdmin
      .from('client_invites')
      .select('id, invited_by')
      .eq('email', email.toLowerCase())
      .eq('status', 'pending')
      .neq('invited_by', effectiveUserId)
      .maybeSingle();

    if (existingInviteFromOthers) {
      return NextResponse.json(
        { error: 'This email already has a pending invitation from another agency' },
        { status: 400 }
      );
    }

    // For instance-based invites, check if there's already a pending invite for this instance
    // This prevents inviting multiple agencies to the same instance simultaneously
    if (existingInstanceId) {
      const { data: existingInstanceInvite } = await supabaseAdmin
        .from('client_invites')
        .select('id')
        .eq('instance_id', existingInstanceId)
        .eq('status', 'pending')
        .maybeSingle();

      if (existingInstanceInvite) {
        return NextResponse.json(
          { error: 'A pending invitation already exists for this instance' },
          { status: 400 }
        );
      }
    }

    // Generate unique token
    const inviteToken = `ci_${randomBytes(24).toString('hex')}`;

    // 30 day expiry for all invites
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Create the invite
    const { data: invite, error: insertError } = await supabaseAdmin
      .from('client_invites')
      .insert({
        token: inviteToken,
        email: email.toLowerCase(),
        invited_by: effectiveUserId,
        storage_size_gb: agencyInstance?.storage_limit_gb ?? 0,
        billing_cycle: 'monthly',
        allow_full_access: false,
        status: 'pending',
        instance_id: existingInstanceId || null,
        is_external: true,
        include_whatsapp: false,
        linked_instance_ids: existingInstanceIds || null,
        linked_service_ids: linkedServiceIds || null,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create invite:', insertError);
      return NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
    }

    // Always use access-grant path (no payment/checkout needed in OSS)
    const inviteUrl = buildAppUrl(`/invite/accept-access?token=${inviteToken}`);
    const agencyName = profile.full_name || 'Your team';

    // Build agency SMTP config if enabled
    let agencySmtp: AgencySmtpConfig | undefined;
    if (profile.agency_smtp_enabled && profile.agency_smtp_host && profile.agency_smtp_pass_encrypted) {
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
        email.toLowerCase(),
        agencyName,
        inviteUrl,
        agencySmtp
      );
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      // Clean up: Delete the invite since email failed
      await supabaseAdmin.from('client_invites').delete().eq('id', invite.id);
      return NextResponse.json({ error: 'Failed to send invitation email' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
      inviteId: invite.id,
    });
  } catch (error) {
    console.error('Invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET: List invites sent by the user OR where user is the agency manager
export async function GET(req: NextRequest) {
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

    // Resolve effective user ID for team members
    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Fetch invites where user (or team owner) is the inviter (agency invites client)
    const { data: sentInvites, error: sentError } = await supabaseAdmin
      .from('client_invites')
      .select('*')
      .eq('invited_by', effectiveUserId)
      .order('created_at', { ascending: false });

    if (sentError) {
      console.error('Failed to fetch sent invites:', sentError);
      return NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
    }

    // Fetch invites where user (or team owner) accepted as agency manager (client invites agency)
    const { data: acceptedInvites, error: acceptedError } = await supabaseAdmin
      .from('client_invites')
      .select('*')
      .eq('accepted_by', effectiveUserId)
      .neq('invited_by', effectiveUserId) // Exclude invites user sent themselves
      .order('created_at', { ascending: false });

    if (acceptedError) {
      console.error('Failed to fetch accepted invites:', acceptedError);
    }

    // For client-invited-agency invites, we need to get the CLIENT's email (the inviter)
    // The invite's `email` field contains the agency's email (who was invited)
    let clientEmailMap: Record<string, string> = {};
    if (acceptedInvites && acceptedInvites.length > 0) {
      const clientIds = acceptedInvites.map(i => i.invited_by);
      const { data: clientProfiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .in('id', clientIds);

      clientProfiles?.forEach(p => {
        clientEmailMap[p.id] = p.email;
      });
    }

    // Merge and deduplicate (sent invites take priority)
    // Also add flag to indicate if agency was invited by client (vs agency invited client)
    const sentIds = new Set((sentInvites || []).map(i => i.id));
    const allInvites = [
      ...(sentInvites || []).map(i => ({ ...i, agency_was_invited: false })),
      ...((acceptedInvites || []).filter(i => !sentIds.has(i.id)).map(i => ({
        ...i,
        agency_was_invited: true,
        // Override email with client's email for display
        email: clientEmailMap[i.invited_by] || i.email,
        original_invitee_email: i.email, // Keep original for reference
      }))),
    ];

    return NextResponse.json({ invites: allInvites });
  } catch (error) {
    console.error('Get invites error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
