import { NextRequest, NextResponse } from 'next/server';
import { getPortalSettings, invalidateSettingsCache } from '@/lib/portalSettings';
import { createFlowEngineClient } from '@/lib/flowengine';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

/**
 * GET /api/flowengine/pricing
 * Tests FlowEngine connection using the saved key and fetches live pricing.
 * Returns: { connected, pricing?, error? }
 */
export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Always read fresh from DB — avoids stale module-level cache in serverless workers
    invalidateSettingsCache();
    const settings = await getPortalSettings();
    const apiKey = settings.flowengine_api_key;

    if (!apiKey) {
      return NextResponse.json({ connected: false, error: 'No API key configured — save your key first' });
    }

    const client = createFlowEngineClient(apiKey);
    if (!client) {
      return NextResponse.json({ connected: false, error: 'No API key configured' });
    }

    // Test connection + fetch pricing in parallel
    const [connResult, pricing] = await Promise.all([
      client.testConnection(),
      client.getPricing().catch(() => null),
    ]);

    if (!connResult.ok) {
      return NextResponse.json({ connected: false, error: connResult.error });
    }

    return NextResponse.json({ connected: true, pricing });
  } catch (err) {
    console.error('[flowengine/pricing] Unexpected error:', err);
    return NextResponse.json({ connected: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/flowengine/pricing
 * Tests a specific key (from the form, before saving). Does not persist the key.
 * Body: { apiKey?: string }
 * Returns: { connected, pricing?, error? }
 */
export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const providedKey = typeof body.apiKey === 'string' ? body.apiKey.trim() : null;

    let apiKey: string | null = providedKey;
    // Always read fresh from DB for the test — avoids stale module-level cache across workers
    invalidateSettingsCache();
    const settings = await getPortalSettings();

    if (!apiKey) {
      apiKey = settings.flowengine_api_key;
    }

    if (!apiKey) {
      return NextResponse.json({ connected: false, error: 'No API key provided' });
    }

    const client = createFlowEngineClient(apiKey);
    if (!client) {
      return NextResponse.json({ connected: false, error: 'Invalid key' });
    }

    const [connResult, pricing] = await Promise.all([
      client.testConnection(),
      client.getPricing().catch(() => null),
    ]);

    if (!connResult.ok) {
      return NextResponse.json({ connected: false, error: connResult.error });
    }

    return NextResponse.json({ connected: true, pricing });
  } catch (err) {
    console.error('[flowengine/pricing] POST Unexpected error:', err);
    return NextResponse.json({ connected: false, error: 'Internal server error' }, { status: 500 });
  }
}
