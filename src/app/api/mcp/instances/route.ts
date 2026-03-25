/**
 * GET /api/mcp/instances
 * Returns the authenticated user's hosted n8n instances.
 * Includes both local portal instances and FlowEngine-hosted instances.
 * Requires: Authorization: Bearer fp_...
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/apiKeyAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient } from '@/lib/flowengine';

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req);
  if (!userId) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', message: 'Invalid or missing API key' },
      { status: 401 }
    );
  }

  // Fetch local portal instances
  const { data: localInstances, error } = await supabaseAdmin
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

  const local = (localInstances ?? []).map(i => ({ ...i, platform: 'local' as const }));

  // Fetch FlowEngine-hosted instances (if API key is configured)
  let flowEngineInstances: any[] = [];
  try {
    const settings = await getPortalSettings();
    const client = createFlowEngineClient(settings.flowengine_api_key ?? undefined, settings.flowengine_api_url ?? undefined);
    if (client) {
      const feInstances = await client.listInstances();
      flowEngineInstances = feInstances.map(i => ({
        id: i.id,
        instance_name: i.instance_name,
        instance_url: i.instance_url,
        status: i.status,
        hosting_mode: 'flowengine',
        service_type: 'n8n',
        domain: null,
        subdomain: null,
        storage_limit_gb: i.storage_gb,
        created_at: i.created_at,
        updated_at: i.updated_at ?? null,
        platform: 'flowengine' as const,
      }));
    }
  } catch {
    // Non-critical — return local instances only if FlowEngine is unavailable
  }

  // Merge, deduplicating by id
  const localIds = new Set(local.map(i => i.id));
  const merged = [...local, ...flowEngineInstances.filter(i => !localIds.has(i.id))];

  return NextResponse.json({ success: true, instances: merged });
}
