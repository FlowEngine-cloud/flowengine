import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { invalidateSettingsCache } from '@/lib/portalSettings';

let _client: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}

// Allowed fields that can be updated
const ALLOWED_FIELDS = [
  'n8n_base_url', 'n8n_api_key', 'n8n_webhook_url',
  'ai_base_url', 'ai_api_key',
  'n8n_smtp_host', 'n8n_smtp_port', 'n8n_smtp_user', 'n8n_smtp_pass', 'n8n_smtp_sender', 'n8n_smtp_ssl',
  'n8n_docker_image', 'n8n_runners_enabled', 'n8n_runner_image',
  'flowengine_api_key',
  'admin_email',
  'allow_signup', 'enable_google_auth', 'enable_linkedin_auth', 'enable_github_auth',
  'oauth_credentials',
];

// Fields that should be masked when returned (sensitive values)
const SENSITIVE_FIELDS = ['n8n_api_key', 'ai_api_key', 'n8n_smtp_pass', 'flowengine_api_key'];

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await getSupabaseAdmin()
      .from('portal_settings')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
    }

    // Mask sensitive fields - only show if set (boolean) not the actual value
    const masked = { ...data };
    for (const field of SENSITIVE_FIELDS) {
      if (masked[field]) {
        masked[field] = '********';
      }
    }
    // Remove internal fields
    delete masked.id;
    delete masked.updated_by;

    return NextResponse.json(masked);
  } catch (error) {
    console.error('[portal-settings] GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();

    // Filter to only allowed fields, skip masked placeholder values
    const updates: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_FIELDS.includes(key) && value !== '********') {
        updates[key] = typeof value === 'string' ? value.trim() : value;
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    updates.updated_at = new Date().toISOString();
    updates.updated_by = user.id;

    // Update the single settings row
    const { error } = await getSupabaseAdmin()
      .from('portal_settings')
      .update(updates)
      .not('id', 'is', null); // Updates all rows (there should be only one)

    if (error) {
      console.error('[portal-settings] Update error:', JSON.stringify(error), 'code:', error.code, 'msg:', error.message, 'details:', error.details);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    // Invalidate cache so next read gets fresh data
    invalidateSettingsCache();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[portal-settings] PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
