import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidUUID, generatePlaceholderEmail } from '@/lib/validation';

/**
 * PATCH /api/agency/clients
 * Update a client's name and/or email.
 * Body: { clientUserId: string, name?: string, email?: string | null }
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const body = await req.json().catch(() => ({}));
    const { clientUserId, name, email } = body;

    if (!clientUserId) return NextResponse.json({ error: 'clientUserId is required' }, { status: 400 });
    if (!name?.trim() && email === undefined) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
    if (name !== undefined && !name?.trim()) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    const updates: Record<string, string> = {};
    if (name?.trim()) updates.name = name.trim();
    if (email !== undefined) {
      updates.email = email?.trim() ? email.trim().toLowerCase() : generatePlaceholderEmail();
    }

    const isNameOnly = typeof clientUserId === 'string' && clientUserId.startsWith('ni_');
    const isPendingPrefixed = typeof clientUserId === 'string' && clientUserId.startsWith('pending:');
    const isUUID = isValidUUID(clientUserId);

    let query = supabaseAdmin.from('client_invites').update(updates).eq('invited_by', effectiveUserId);

    if (isNameOnly) {
      query = query.eq('id', clientUserId.slice('ni_'.length));
    } else if (isPendingPrefixed) {
      query = query.eq('id', clientUserId.slice('pending:'.length));
    } else if (isUUID) {
      query = query.eq('accepted_by', clientUserId);
    } else {
      // email-based key (pending client with real email as userId)
      query = query.eq('email', clientUserId);
    }

    const { data: updated, error: updateError } = await query.select('id');
    if (updateError) {
      return NextResponse.json({ error: `Failed to update client: ${updateError.message}` }, { status: 500 });
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/agency/clients
 * Create a client by name (and optional email) — no SMTP required.
 * Body: { name: string, email?: string, existingInstanceIds?: string[], linkedServiceIds?: string[] }
 */
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const body = await req.json().catch(() => ({}));
    const { name, email, existingInstanceIds, linkedServiceIds } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }

    // Validate instance IDs if provided
    if (existingInstanceIds?.length) {
      for (const id of existingInstanceIds) {
        if (!isValidUUID(id)) return NextResponse.json({ error: 'Invalid instance ID' }, { status: 400 });
      }
      const { data: owned } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id')
        .in('id', existingInstanceIds)
        .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
        .is('deleted_at', null);
      const ownedIds = new Set((owned || []).map((i: { id: string }) => i.id));
      if (existingInstanceIds.some((id: string) => !ownedIds.has(id))) {
        return NextResponse.json({ error: 'One or more instances not found or access denied' }, { status: 403 });
      }
    }

    // Use real email if provided, otherwise generate a placeholder (NOT NULL constraint)
    const clientEmail = email?.trim() ? email.trim().toLowerCase() : generatePlaceholderEmail();
    const inviteToken = `ci_${randomBytes(24).toString('hex')}`;

    // Create the record as immediately accepted — no Supabase auth user needed
    const { data: invite, error: insertError } = await supabaseAdmin
      .from('client_invites')
      .insert({
        token: inviteToken,
        email: clientEmail,
        name: name.trim(),
        invited_by: effectiveUserId,
        status: 'accepted',
        accepted_at: new Date().toISOString(),
        accepted_by: null,
        storage_size_gb: 0,
        billing_cycle: 'monthly',
        allow_full_access: false,
        is_external: true,
        include_whatsapp: false,
        linked_instance_ids: existingInstanceIds?.length ? existingInstanceIds : null,
        linked_service_ids: linkedServiceIds?.length ? linkedServiceIds : null,
        expires_at: new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create client:', insertError);
      return NextResponse.json({ error: `Failed to create client: ${insertError.message}` }, { status: 500 });
    }

    return NextResponse.json({ success: true, clientId: invite.id });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
