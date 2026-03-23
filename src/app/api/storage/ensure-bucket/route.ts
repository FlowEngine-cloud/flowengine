/**
 * POST /api/storage/ensure-bucket
 *
 * Ensures the agency-branding storage bucket exists.
 * Called client-side before the first logo upload to handle deployments
 * where the db-migrate container ran before storage-api initialized its schema.
 *
 * Uses PostgREST (storage schema exposed via PGRST_DB_SCHEMAS) so it works
 * even if the storage-api service hasn't fully started yet.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const BUCKET_ID = 'agency-branding';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check existence via PostgREST (direct DB access, no storage-api dependency)
    const { data: existing } = await (supabaseAdmin as any)
      .schema('storage')
      .from('buckets')
      .select('id')
      .eq('id', BUCKET_ID)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ ok: true, created: false });
    }

    // Insert bucket directly via PostgREST
    const { error: insertError } = await (supabaseAdmin as any)
      .schema('storage')
      .from('buckets')
      .insert({
        id: BUCKET_ID,
        name: BUCKET_ID,
        public: true,
        file_size_limit: 2097152,
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      });

    if (insertError) throw insertError;

    return NextResponse.json({ ok: true, created: true });
  } catch (err: any) {
    console.error('[storage/ensure-bucket]', err);
    return NextResponse.json({ error: err.message || 'Failed to ensure bucket' }, { status: 500 });
  }
}
