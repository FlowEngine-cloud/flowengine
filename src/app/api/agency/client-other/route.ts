/**
 * Agency Client Other Properties API
 *
 * GET    /api/agency/client-other?clientUserId=xxx - List custom entries for a client
 * POST   /api/agency/client-other - Create a new custom entry
 * PUT    /api/agency/client-other - Update an existing custom entry
 * DELETE /api/agency/client-other?id=xxx - Delete a custom entry
 */
import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, checkRateLimit } from '@/lib/validation';
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

    const { data, error } = await supabaseAdmin
      .from('agency_client_custom_entries')
      .select('*')
      .eq('agency_id', effectiveUserId)
      .eq('client_user_id', clientUserId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Client other GET error:', error);
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }

    return NextResponse.json({ entries: data || [] });
  } catch (error) {
    console.error('Client other GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rateLimitResult = checkRateLimit(`client-other:${user.id}`, 20, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);
    const body = await req.json();
    const { clientUserId, name, domain, access, notes } = body;

    if (!clientUserId || !name?.trim()) {
      return NextResponse.json({ error: 'clientUserId and name are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('agency_client_custom_entries')
      .insert({
        agency_id: effectiveUserId,
        client_user_id: clientUserId,
        name: name.trim(),
        domain: domain?.trim() || '',
        access: access?.trim() || '',
        notes: notes?.trim() || '',
      })
      .select('*')
      .single();

    if (error) {
      console.error('Client other POST error:', error);
      return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 });
    }

    return NextResponse.json({ entry: data });
  } catch (error) {
    console.error('Client other POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rateLimitResult = checkRateLimit(`client-other:${user.id}`, 20, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);
    const body = await req.json();
    const { id, name, domain, access, notes } = body;

    if (!id || !isValidUUID(id) || !name?.trim()) {
      return NextResponse.json({ error: 'Valid id and name are required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('agency_client_custom_entries')
      .update({
        name: name.trim(),
        domain: domain?.trim() || '',
        access: access?.trim() || '',
        notes: notes?.trim() || '',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('agency_id', effectiveUserId)
      .select('*')
      .single();

    if (error) {
      console.error('Client other PUT error:', error);
      return NextResponse.json({ error: 'Failed to update entry' }, { status: 500 });
    }

    return NextResponse.json({ entry: data });
  } catch (error) {
    console.error('Client other PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);
    const id = req.nextUrl.searchParams.get('id');

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: 'Valid id required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('agency_client_custom_entries')
      .delete()
      .eq('id', id)
      .eq('agency_id', effectiveUserId);

    if (error) {
      console.error('Client other DELETE error:', error);
      return NextResponse.json({ error: 'Failed to delete entry' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Client other DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
