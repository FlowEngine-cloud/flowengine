/**
 * GET /api/mcp/clients
 * Returns the authenticated user's clients with their assigned instances.
 * Requires: Authorization: Bearer fp_...
 *
 * Used by the flowengine-mcp server to list agency clients from Claude.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/apiKeyAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Invalid or missing API key' },
      { status: 401 }
    );
  }

  // Fetch all client invites created by this agency user
  const { data: invites, error: inviteError } = await supabaseAdmin
    .from('client_invites')
    .select('id, email, name, status, created_at, accepted_at, linked_instance_ids')
    .eq('invited_by', userId)
    .order('created_at', { ascending: false });

  if (inviteError) {
    return NextResponse.json(
      { success: false, error: 'Database error', message: 'Failed to fetch clients' },
      { status: 500 }
    );
  }

  // Fetch instances assigned to clients of this agency
  const { data: instances } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_name, instance_url, status, invited_by_user_id, user_id, ai_payer')
    .eq('invited_by_user_id', userId)
    .is('deleted_at', null);

  // Group instances by their client (user_id)
  const instancesByClient: Record<string, typeof instances> = {};
  for (const inst of instances ?? []) {
    const clientId = inst.user_id ?? 'unassigned';
    if (!instancesByClient[clientId]) instancesByClient[clientId] = [];
    instancesByClient[clientId]!.push(inst);
  }

  // Build client list enriched with instance counts
  const clients = (invites ?? []).map(invite => ({
    id: invite.id,
    email: invite.email,
    name: invite.name,
    status: invite.status,
    created_at: invite.created_at,
    accepted_at: invite.accepted_at,
    instance_count: (invite.linked_instance_ids ?? []).length,
    instances: instancesByClient[invite.id] ?? [],
  }));

  return NextResponse.json({ success: true, clients });
}
