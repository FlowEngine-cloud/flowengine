import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { emailService } from '@/lib/emailService';
import { isValidUUID, isValidEmail, checkRateLimit } from '@/lib/validation';
import { buildAppUrl } from '@/lib/config';
import { getEffectiveOwnerId, canWrite } from '@/lib/teamUtils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Assign a client to an agency-owned instance
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const { instanceId } = await params;

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

    // Rate limiting: max 5 client assignments per hour per user
    const rateLimitResult = checkRateLimit(`assign-client:${user.id}`, 5, 60 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many client assignments. Please try again later.' },
        { status: 429 }
      );
    }

    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);
    if (!canWrite(ctx.role)) {
      return NextResponse.json({ error: 'You do not have permission to assign clients' }, { status: 403 });
    }
    const effectiveUserId = ctx.ownerId;

    const { email } = await req.json();

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
    }

    // Run ownership checks in parallel
    const [{ data: instance }, { data: existingClient }, { data: profile }] = await Promise.all([
      // Verify user owns this instance OR is agency manager
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('*')
        .eq('id', instanceId)
        .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
        .maybeSingle(),
      // Check if client already assigned
      supabaseAdmin
        .from('client_instances')
        .select('id')
        .eq('instance_id', instanceId)
        .maybeSingle(),
      // Get agency profile for email
      supabaseAdmin
        .from('profiles')
        .select('full_name')
        .eq('id', effectiveUserId)
        .maybeSingle(),
    ]);

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or access denied' }, { status: 403 });
    }

    if (existingClient) {
      return NextResponse.json({ error: 'Client already assigned to this instance' }, { status: 400 });
    }

    // Create invite with agency-paid flag
    const inviteToken = `ci_${randomBytes(24).toString('hex')}`;
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days for agency-paid

    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('client_invites')
      .insert({
        token: inviteToken,
        email: email.toLowerCase(), // Normalize email
        invited_by: effectiveUserId,
        instance_id: instanceId, // Link invite to specific instance for agency-paid model
        storage_size_gb: instance.storage_limit_gb,
        allow_full_access: false, // Agency-owned = simplified access only
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (inviteError) {
      console.error('Failed to create invite:', inviteError);
      return NextResponse.json({ error: `Failed to create invitation: ${inviteError.message}` }, { status: 500 });
    }

    // Send invitation email (agency-paid variant)
    const inviteUrl = buildAppUrl(`/invite/accept-access?token=${inviteToken}`);
    const agencyName = profile?.full_name || 'Your agency';

    let emailSent = true;
    try {
      await emailService.sendClientAccessGrant(email, agencyName, inviteUrl);
    } catch (emailError) {
      console.error('Failed to send invitation email:', emailError);
      emailSent = false;
    }

    // Auto-create a category for this instance in UI Studio (if not exists)
    const { data: existingCategory } = await supabaseAdmin
      .from('widget_categories')
      .select('id')
      .eq('user_id', effectiveUserId)
      .eq('instance_id', instanceId)
      .maybeSingle();

    if (!existingCategory) {
      // Get max display order
      const { data: maxOrderResult } = await supabaseAdmin
        .from('widget_categories')
        .select('display_order')
        .eq('user_id', effectiveUserId)
        .order('display_order', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextOrder = (maxOrderResult?.display_order ?? -1) + 1;

      await supabaseAdmin.from('widget_categories').insert({
        user_id: effectiveUserId,
        name: instance.instance_name,
        description: `Widgets for ${instance.instance_name}`,
        color: '#6366f1',
        display_order: nextOrder,
        instance_id: instanceId,
      });
    }

    return NextResponse.json({
      success: true,
      client: {
        email,
        status: 'pending',
        invite_id: invite.id,
        created_at: invite.created_at,
      },
      emailSent,
      ...(emailSent ? {} : { inviteUrl }),
    });
  } catch (error) {
    console.error('Assign client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
