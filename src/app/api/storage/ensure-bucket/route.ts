/**
 * POST /api/storage/ensure-bucket
 *
 * Ensures the agency-branding storage bucket exists.
 * Called client-side before the first logo upload to handle deployments
 * where the db-migrate container ran before storage initialized its schema.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

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

    // Check if bucket already exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    if (listError) throw listError;

    const exists = buckets?.some(b => b.id === 'agency-branding');
    if (exists) {
      return NextResponse.json({ ok: true, created: false });
    }

    // Create the bucket
    const { error: createError } = await supabaseAdmin.storage.createBucket('agency-branding', {
      public: true,
      fileSizeLimit: 2097152,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
    });

    if (createError) throw createError;

    return NextResponse.json({ ok: true, created: true });
  } catch (err: any) {
    console.error('[storage/ensure-bucket]', err);
    return NextResponse.json({ error: err.message || 'Failed to ensure bucket' }, { status: 500 });
  }
}
