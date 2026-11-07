import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { invalidateSettingsCache } from '@/lib/portalSettings';
import { getEffectiveOwnerId, canManageBilling } from '@/lib/teamUtils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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
const SENSITIVE_FIELDS = ['n8n_api_key', 'ai_api_key', 'n8n_smtp_pass', 'flowengine_api_key', 'coolify_api_token'];

// Keys inside oauth_credentials that hold secrets. They are masked on read and
// never overwritten by masked placeholder values on write.
const OAUTH_SECRET_KEY_PATTERN = /secret|token|password|apikey|private/i;

// Return a copy of oauth_credentials with secret values masked (UI shows them as "set").
function maskOauthCredentials(creds: any): Record<string, any> {
  if (!creds || typeof creds !== 'object') return {};
  const maskedCreds: Record<string, any> = {};
  for (const [provider, fields] of Object.entries(creds)) {
    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      maskedCreds[provider] = fields;
      continue;
    }
    const maskedFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(fields as Record<string, any>)) {
      maskedFields[key] =
        typeof value === 'string' && value && OAUTH_SECRET_KEY_PATTERN.test(key) ? '********' : value;
    }
    maskedCreds[provider] = maskedFields;
  }
  return maskedCreds;
}

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
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
    }

    // No row yet — return safe empty defaults so the UI doesn't break
    if (!data) {
      return NextResponse.json({
        oauth_credentials: {},
        // Surface env-var-backed keys so the UI shows "Connected" and allows disconnecting
        ...(process.env.FLOWENGINE_API_KEY ? { flowengine_api_key: '********' } : {}),
        ...(process.env.AI_API_KEY ? { ai_api_key: '********' } : {}),
      });
    }

    // Mask sensitive fields - only show if set (boolean) not the actual value
    const masked = { ...data };
    for (const field of SENSITIVE_FIELDS) {
      if (masked[field]) {
        masked[field] = '********';
      }
    }
    // Surface flowengine_api_key stored in oauth_credentials (fallback for older installs missing the column)
    const oauthCreds = masked.oauth_credentials || {};
    if (!masked.flowengine_api_key && oauthCreds.flowengine_api_key) {
      masked.flowengine_api_key = '********';
    }
    // Surface env-var-backed keys that have no DB value yet
    if (!masked.flowengine_api_key && process.env.FLOWENGINE_API_KEY) {
      masked.flowengine_api_key = '********';
    }
    // Mask secrets nested inside oauth_credentials (client secrets, tokens)
    masked.oauth_credentials = maskOauthCredentials(masked.oauth_credentials);

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

    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);
    if (!canManageBilling(ctx.role)) {
      return NextResponse.json({ error: 'Only owners and admins can update portal settings' }, { status: 403 });
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

    // Ensure a row exists, then update it (order by updated_at so we always touch the canonical row)
    const { data: existing } = await getSupabaseAdmin()
      .from('portal_settings')
      .select('id, oauth_credentials')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Restore masked placeholder values inside oauth_credentials from the stored row so a
    // settings save never overwrites real client secrets with "********". Providers omitted
    // from the payload are dropped (full-replace semantics preserved for disconnects).
    if (updates.oauth_credentials && typeof updates.oauth_credentials === 'object') {
      const existingCreds =
        existing?.oauth_credentials && typeof existing.oauth_credentials === 'object'
          ? (existing.oauth_credentials as Record<string, any>)
          : {};
      const cleanedCreds: Record<string, any> = {};
      for (const [provider, fields] of Object.entries(updates.oauth_credentials)) {
        if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
          cleanedCreds[provider] = fields;
          continue;
        }
        const prev =
          existingCreds[provider] && typeof existingCreds[provider] === 'object'
            ? (existingCreds[provider] as Record<string, any>)
            : {};
        const cleanedFields: Record<string, any> = {};
        for (const [key, value] of Object.entries(fields as Record<string, any>)) {
          if (value === '********') {
            if (prev[key] !== undefined) cleanedFields[key] = prev[key];
            continue;
          }
          cleanedFields[key] = typeof value === 'string' ? value.trim() : value;
        }
        cleanedCreds[provider] = cleanedFields;
      }
      updates.oauth_credentials = cleanedCreds;
    }

    // flowengine_api_key may not exist as a column in older installs — fall back to oauth_credentials JSONB
    const JSONB_FALLBACK_FIELDS = ['flowengine_api_key'];

    const doUpsert = async (payload: Record<string, any>) => {
      if (existing?.id) {
        return getSupabaseAdmin().from('portal_settings').update(payload).eq('id', existing.id);
      }
      return getSupabaseAdmin().from('portal_settings').insert(payload);
    };

    let { error } = await doUpsert(updates);

    // If a column doesn't exist (42703), move those fields into oauth_credentials and retry
    if (error?.code === '42703') {
      const fallback: Record<string, any> = {};
      for (const f of JSONB_FALLBACK_FIELDS) {
        if (updates[f] !== undefined) {
          fallback[f] = updates[f];
          delete updates[f];
        }
      }
      if (Object.keys(fallback).length > 0) {
        // Merge into existing oauth_credentials
        const { data: row } = await getSupabaseAdmin()
          .from('portal_settings')
          .select('oauth_credentials')
          .limit(1)
          .maybeSingle();
        updates.oauth_credentials = { ...(row?.oauth_credentials || {}), ...fallback };
        ({ error } = await doUpsert(updates));
      }
    }

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
