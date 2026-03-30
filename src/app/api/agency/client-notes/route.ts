/**
 * Agency Client Notes API
 *
 * GET  /api/agency/client-notes?clientUserId=xxx - Get notes for a client
 * PUT  /api/agency/client-notes - Save notes for a client
 */
import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);
    const clientUserId = req.nextUrl.searchParams.get('clientUserId');

    if (!clientUserId) {
      return NextResponse.json({ error: 'clientUserId required' }, { status: 400 });
    }

    const { data } = await supabaseAdmin
      .from('agency_client_notes')
      .select('notes')
      .eq('agency_id', effectiveUserId)
      .eq('client_user_id', clientUserId)
      .maybeSingle();

    return NextResponse.json({ notes: data?.notes || '' });
  } catch (error) {
    console.error('Client notes GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rateLimitResult = checkRateLimit(`client-notes:${user.id}`, 20, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);
    const body = await req.json();
    const { clientUserId, notes } = body;

    if (!clientUserId) {
      return NextResponse.json({ error: 'clientUserId required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('agency_client_notes')
      .upsert({
        agency_id: effectiveUserId,
        client_user_id: clientUserId,
        notes: notes ?? '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agency_id,client_user_id' });

    if (error) {
      console.error('Client notes upsert error:', error);
      return NextResponse.json({ error: 'Failed to save notes' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Client notes PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
