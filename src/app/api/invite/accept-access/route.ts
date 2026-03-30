import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// GET: Validate token and return invite details
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token || !token.startsWith('ci_')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const { data: invite, error } = await supabaseAdmin
      .from('client_invites')
      .select('id, email, status, expires_at, invited_by, instance_id, linked_instance_ids, allow_full_access')
      .eq('token', token)
      .maybeSingle();

    if (error || !invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation has already been used or cancelled' }, { status: 410 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    // Get inviter name
    const { data: inviter } = await supabaseAdmin
      .from('profiles')
      .select('full_name, business_name')
      .eq('id', invite.invited_by)
      .single();

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      inviterName: inviter?.business_name || inviter?.full_name || 'Your agency',
    });
  } catch (error) {
    console.error('Accept-access GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Accept the invite — link client to instance(s)
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

    const { token } = await req.json();
    if (!token || !token.startsWith('ci_')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const { data: invite, error: fetchErr } = await supabaseAdmin
      .from('client_invites')
      .select('id, email, status, expires_at, invited_by, instance_id, linked_instance_ids, allow_full_access')
      .eq('token', token)
      .maybeSingle();

    if (fetchErr || !invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation has already been used or cancelled' }, { status: 410 });
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
    }

    // Email must match the invite recipient
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json({
        error: `This invitation was sent to ${invite.email}. Please sign in with that email address.`,
      }, { status: 403 });
    }

    // Collect all instance IDs to link
    const instanceIds: string[] = [];
    if (invite.instance_id) instanceIds.push(invite.instance_id);
    if (invite.linked_instance_ids?.length) {
      for (const id of invite.linked_instance_ids) {
        if (!instanceIds.includes(id)) instanceIds.push(id);
      }
    }

    const accessLevel = invite.allow_full_access ? 'edit' : 'view';
    const now = new Date().toISOString();

    // Create client_instances records for each instance
    if (instanceIds.length > 0) {
      const clientInstanceRows = instanceIds.map((instanceId) => ({
        team_id: invite.invited_by, // agency owner acts as team
        client_id: user.id,
        user_id: user.id,
        instance_id: instanceId,
        invited_by: invite.invited_by,
        assigned_by: invite.invited_by,
        access_level: accessLevel,
      }));

      const { error: ciError } = await supabaseAdmin
        .from('client_instances')
        .insert(clientInstanceRows);

      if (ciError) {
        console.error('Failed to create client_instances:', ciError);
        // Non-fatal — continue to mark invite accepted
      }

      // Update pay_per_instance_deployments.client_id for each instance
      await supabaseAdmin
        .from('pay_per_instance_deployments')
        .update({ client_id: user.id, invited_by_user_id: invite.invited_by })
        .in('id', instanceIds)
        .is('client_id', null);
    }

    // Mark invite as accepted
    const { error: updateErr } = await supabaseAdmin
      .from('client_invites')
      .update({ status: 'accepted', accepted_by: user.id, accepted_at: now })
      .eq('id', invite.id)
      .eq('status', 'pending');

    if (updateErr) {
      console.error('Failed to mark invite accepted:', updateErr);
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    // Backfill pre-invited team members that were added before the client accepted
    await supabaseAdmin
      .from('team_members')
      .update({ owner_id: user.id, pending_client_invite_id: null })
      .eq('pending_client_invite_id', invite.id);

    return NextResponse.json({ success: true, redirectTo: '/portal' });
  } catch (error) {
    console.error('Accept-access POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
