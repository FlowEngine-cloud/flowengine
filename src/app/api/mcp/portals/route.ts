/**
 * GET /api/mcp/portals
 * Returns the authenticated user's n8n instances (client portals).
 * Requires: Authorization: Bearer fp_...
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

  const { data: portals, error } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_name, instance_url, status, client_id, client_name, hosting_mode, service_type, created_at, updated_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: 'Database error', message: 'Failed to fetch portals' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, portals: portals ?? [] });
}
