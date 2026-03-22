import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET: Validate token and return invite info
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token');
    if (!token || !token.startsWith('tm_')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    const { data: invite, error } = await supabaseAdmin
      .from('team_members')
      .select('id, email, role, status, owner_id')
      .eq('token', token)
      .maybeSingle();

    if (error || !invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 410 });
    }

    // Get owner name
    const { data: owner } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', invite.owner_id)
      .single();

    return NextResponse.json({
      id: invite.id,
      email: invite.email,
      role: invite.role,
      inviterName: owner?.full_name || 'Your team',
    });
  } catch (error) {
    console.error('Team accept GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Accept the invitation
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
    if (!token || !token.startsWith('tm_')) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 400 });
    }

    // Atomically accept: only update if still pending
    const { data: invite, error: fetchErr } = await supabaseAdmin
      .from('team_members')
      .select('id, email, owner_id, status')
      .eq('token', token)
      .maybeSingle();

    if (fetchErr || !invite) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
    }

    if (invite.status !== 'pending') {
      return NextResponse.json({ error: 'This invitation has already been used' }, { status: 410 });
    }

    // Email must match
    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return NextResponse.json({
        error: `This invitation was sent to ${invite.email}. Please sign in with that email.`,
      }, { status: 403 });
    }

    // Can't join your own team
    if (user.id === invite.owner_id) {
      return NextResponse.json({ error: 'You cannot join your own team' }, { status: 400 });
    }

    // Check if user is already a member of another team
    const { data: existingMembership } = await supabaseAdmin
      .from('team_members')
      .select('id')
      .eq('member_id', user.id)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();

    if (existingMembership) {
      return NextResponse.json({
        error: 'You are already a member of another team. Leave that team first.',
      }, { status: 409 });
    }

    // Atomic update
    const { error: updateErr } = await supabaseAdmin
      .from('team_members')
      .update({
        member_id: user.id,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        token: null, // Clear token after use
      })
      .eq('id', invite.id)
      .eq('status', 'pending'); // Ensure still pending (race condition protection)

    if (updateErr) {
      console.error('Team accept update error:', updateErr);
      return NextResponse.json({ error: 'Failed to accept invitation' }, { status: 500 });
    }

    return NextResponse.json({ success: true, redirectTo: '/portal' });
  } catch (error) {
    console.error('Team accept POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
