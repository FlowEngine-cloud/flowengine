import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidUUID } from '@/lib/validation';

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
        .eq('user_id', effectiveUserId)
        .is('deleted_at', null);
      const ownedIds = new Set((owned || []).map((i: { id: string }) => i.id));
      if (existingInstanceIds.some((id: string) => !ownedIds.has(id))) {
        return NextResponse.json({ error: 'One or more instances not found or access denied' }, { status: 403 });
      }
    }

    // Use real email if provided, otherwise generate a placeholder (NOT NULL constraint)
    const placeholderId = randomBytes(8).toString('hex');
    const clientEmail = email?.trim()
      ? email.trim().toLowerCase()
      : `noemail-${placeholderId}@portal.local`;
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
      return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
    }

    return NextResponse.json({ success: true, clientId: invite.id });
  } catch (error) {
    console.error('Create client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
