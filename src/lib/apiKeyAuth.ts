/**
 * API Key Authentication Helper
 *
 * Validates `fp_` Bearer tokens against the api_key table.
 * Returns the user_id on success, or null on failure.
 *
 * Usage in a route:
 *   const userId = await validateApiKey(request);
 *   if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
 */

import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function validateApiKey(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer fp_')) return null;

  const apiKey = authHeader.slice(7); // strip "Bearer "
  const keyHash = createHash('sha256').update(apiKey).digest('hex');

  const { data } = await supabaseAdmin
    .from('api_key')
    .select('user_id')
    .eq('key_hash', keyHash)
    .single();

  if (!data?.user_id) return null;

  // Update last_used_at asynchronously — don't await, don't block the request
  supabaseAdmin
    .from('api_key')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', keyHash)
    .then(() => {});

  return data.user_id as string;
}
