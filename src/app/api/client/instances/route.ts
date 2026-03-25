import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET: List client instances for an agency
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

    // User must be logged in (auth already checked above)

    // Get client instances from TWO sources:
    // 1. client_instances table - where agency invited client
    // 2. pay_per_instance_deployments - where client invited agency (invited_by_user_id)
    const [{ data: clientInstances, error }, { data: clientInvitedInstances }] = await Promise.all([
      supabaseAdmin
        .from('client_instances')
        .select(`
          *,
          instance:pay_per_instance_deployments(
            id,
            instance_name,
            instance_url,
            status,
            storage_limit_gb,
            created_at,
            user_id,
            is_external,
            service_type,
            deleted_at
          )
        `)
        .eq('invited_by', effectiveUserId),
      // Instances where client invited this agency
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, instance_name, instance_url, status, storage_limit_gb, created_at, user_id, is_external, service_type')
        .eq('invited_by_user_id', effectiveUserId)
        .is('deleted_at', null)
    ]);

    if (error) {
      console.error('Failed to fetch client instances:', error);
      return NextResponse.json({ error: 'Failed to fetch client instances' }, { status: 500 });
    }

    // Get client emails for all client user IDs (both sources)
    const allClientUserIds = new Set<string>();
    (clientInvitedInstances || []).forEach(i => { if (i.user_id) allClientUserIds.add(i.user_id); });
    (clientInstances || []).forEach((ci: { user_id: string }) => { if (ci.user_id) allClientUserIds.add(ci.user_id); });
    let clientProfiles: Record<string, string> = {};
    if (allClientUserIds.size > 0) {
      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, email')
        .in('id', Array.from(allClientUserIds));
      profiles?.forEach(p => {
        clientProfiles[p.id] = p.email;
      });
    }

    // Get all invites: accepted (for linking) + pending (to show in client list)
    const [{ data: invites }, { data: pendingInvites }] = await Promise.all([
      supabaseAdmin
        .from('client_invites')
        .select('id, email, name, accepted_by')
        .eq('invited_by', effectiveUserId)
        .eq('status', 'accepted'),
      supabaseAdmin
        .from('client_invites')
        .select('id, email, name')
        .eq('invited_by', effectiveUserId)
        .eq('status', 'pending'),
    ]);

    // Define types for the data structures
    type InviteRecord = {
      id: string;
      email: string;
      name: string | null;
      accepted_by: string | null;
    };

    type ClientInstanceRecord = {
      instance_id: string;
      user_id: string;
      instance: {
        id: string;
        instance_name: string;
        instance_url: string;
        status: string;
        storage_limit_gb: number;
        created_at: string;
        is_external?: boolean;
        service_type?: string | null;
        deleted_at?: string | null;
      } | null;
    };

    // Create a map of user_id -> invite for quick lookup
    const inviteByUserId = new Map<string, { id: string; email: string }>();
    (invites || []).forEach((inv: InviteRecord) => {
      if (inv.accepted_by) {
        inviteByUserId.set(inv.accepted_by, { id: inv.id, email: inv.email });
      }
    });

    // Build a map of invite_id -> name for invited clients
    const inviteNameById = new Map<string, string | null>();
    (invites || []).forEach((inv: InviteRecord) => {
      inviteNameById.set(inv.id, inv.name);
    });

    // Transform agency-invited instances (skip records with no instance data)
    const agencyInvitedMapped = (clientInstances || [])
      .filter((ci: ClientInstanceRecord) => ci.instance)
      .map((ci: ClientInstanceRecord) => {
        const invite = inviteByUserId.get(ci.user_id);
        const isDeleted = !!ci.instance?.deleted_at;
        return {
          instance_id: ci.instance_id,
          user_id: ci.user_id,
          invite_id: invite?.id,
          instance_name: ci.instance?.instance_name,
          instance_url: ci.instance?.instance_url,
          status: isDeleted ? 'deleted' : ci.instance?.status,
          storage_limit_gb: ci.instance?.storage_limit_gb,
          created_at: ci.instance?.created_at,
          client_email: invite?.email || clientProfiles[ci.user_id] || undefined,
          client_name: invite?.id ? (inviteNameById.get(invite.id) || undefined) : undefined,
          client_paid: false,
          is_external: ci.instance?.is_external || false,
          service_type: ci.instance?.service_type || null,
          invite_status: 'accepted',
        };
      });

    // Transform client-invited instances (client paid, invited agency)
    const clientInvitedMapped = (clientInvitedInstances || []).map(inst => ({
      instance_id: inst.id,
      user_id: inst.user_id,
      invite_id: undefined,
      instance_name: inst.instance_name,
      instance_url: inst.instance_url,
      status: inst.status,
      storage_limit_gb: inst.storage_limit_gb,
      created_at: inst.created_at,
      client_email: clientProfiles[inst.user_id] || undefined,
      client_name: undefined,
      client_paid: true,
      is_external: inst.is_external || false,
      service_type: (inst as any).service_type || null,
      invite_status: 'accepted',
    }));

    // Merge both sources
    const agencyInstanceIds = new Set(agencyInvitedMapped.map(i => i.instance_id));
    const instances = [
      ...agencyInvitedMapped,
      ...clientInvitedMapped.filter(i => !agencyInstanceIds.has(i.instance_id)),
    ];

    // Include accepted invites that have no instances yet (so they still appear in the client list)
    // Also include name-only clients (accepted_by = null, placeholder email)
    const usersWithInstances = new Set(instances.map(i => i.user_id));
    const isNameOnlyInvite = (inv: InviteRecord) =>
      !inv.accepted_by && inv.email.startsWith('noemail-') && inv.email.endsWith('@portal.local');

    const inviteOnlyClients = (invites || [])
      .filter((inv: InviteRecord) =>
        isNameOnlyInvite(inv) ||
        (inv.accepted_by && !usersWithInstances.has(inv.accepted_by))
      )
      .map((inv: InviteRecord) => ({
        instance_id: `invite:${inv.id}`,
        user_id: isNameOnlyInvite(inv) ? `ni_${inv.id}` : inv.accepted_by!,
        invite_id: inv.id,
        instance_name: '',
        instance_url: '',
        status: 'none',
        storage_limit_gb: 0,
        created_at: '',
        client_email: inv.email,
        client_name: inv.name || undefined,
        client_paid: false,
        is_external: false,
        invite_status: 'accepted',
      }));

    // Include pending invites (email-invited clients who haven't accepted yet)
    const pendingClients = (pendingInvites || []).map((inv: { id: string; email: string; name: string | null }) => ({
      instance_id: `invite:${inv.id}`,
      user_id: `pending:${inv.id}`,
      invite_id: inv.id,
      instance_name: '',
      instance_url: '',
      status: 'none',
      storage_limit_gb: 0,
      created_at: '',
      client_email: inv.email,
      client_name: inv.name || undefined,
      client_paid: false,
      is_external: false,
      invite_status: 'pending',
    }));

    // Exclude pending clients whose email already appears as accepted
    const acceptedEmails = new Set([
      ...(invites || []).map((inv: InviteRecord) => inv.email),
      ...instances.map(i => i.client_email).filter(Boolean),
    ]);
    const filteredPending = pendingClients.filter(p => !acceptedEmails.has(p.client_email));

    return NextResponse.json({ instances: [...instances, ...inviteOnlyClients, ...filteredPending] });
  } catch (error) {
    console.error('Client instances error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Directly assign an existing client to an instance (no invite email)
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

    const rateLimitResult = checkRateLimit(`assign-instance:${user.id}`, 10, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { instance_id, client_user_id } = body;

    if (!instance_id || !isValidUUID(instance_id)) {
      return NextResponse.json({ error: 'Valid instance_id required' }, { status: 400 });
    }
    if (!client_user_id || !isValidUUID(client_user_id)) {
      return NextResponse.json({ error: 'Valid client_user_id required' }, { status: 400 });
    }

    // Verify agency owns this instance
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id')
      .eq('id', instance_id)
      .eq('user_id', effectiveUserId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or access denied' }, { status: 403 });
    }

    // Enforce one-client-per-instance rule
    const { data: existingAssignment } = await supabaseAdmin
      .from('client_instances')
      .select('id, user_id')
      .eq('instance_id', instance_id)
      .maybeSingle();

    if (existingAssignment) {
      if (existingAssignment.user_id === client_user_id) {
        return NextResponse.json({ error: 'Client already assigned to this instance' }, { status: 400 });
      }
      return NextResponse.json({ error: 'Instance already has a client assigned. Revoke access first.' }, { status: 400 });
    }

    // Create the assignment directly
    const { error: insertError } = await supabaseAdmin
      .from('client_instances')
      .insert({
        instance_id,
        user_id: client_user_id,
        invited_by: effectiveUserId,
      });

    if (insertError) {
      console.error('Failed to assign instance:', insertError);
      return NextResponse.json({ error: 'Failed to assign instance' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Assign instance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Revoke client access to an instance
export async function DELETE(req: NextRequest) {
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

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { instance_id, user_id: clientUserId } = body;

    if (!instance_id || !isValidUUID(instance_id)) {
      return NextResponse.json({ error: 'Valid instance_id required' }, { status: 400 });
    }

    // Delete the client_instances record
    const { error: deleteError } = await supabaseAdmin
      .from('client_instances')
      .delete()
      .eq('instance_id', instance_id)
      .eq('invited_by', effectiveUserId)
      .eq('user_id', clientUserId);

    if (deleteError) {
      console.error('Failed to revoke access:', deleteError);
      return NextResponse.json({ error: 'Failed to revoke access' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Revoke access error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
