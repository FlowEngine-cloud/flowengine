/**
 * GET /api/mcp/instances
 * Returns the authenticated user's hosted n8n instances.
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

  const { data: instances, error } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_name, instance_url, status, hosting_mode, service_type, domain, subdomain, storage_limit_gb, created_at, updated_at')
    .eq('user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: 'Database error', message: 'Failed to fetch instances' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, instances: instances ?? [] });
}
