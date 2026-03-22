import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveOwnerId, canManageTeam } from '@/lib/teamUtils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET: List team members
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

    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);

    if (!canManageTeam(ctx.role)) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    const { data: members, error } = await supabaseAdmin
      .from('team_members')
      .select('id, email, role, status, invited_at, accepted_at')
      .eq('owner_id', ctx.ownerId)
      .neq('status', 'removed')
      .order('invited_at', { ascending: false });

    if (error) {
      console.error('List team members error:', error);
      return NextResponse.json({ error: 'Failed to load team members' }, { status: 500 });
    }

    return NextResponse.json({ members: members || [] });
  } catch (error) {
    console.error('Team members GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
