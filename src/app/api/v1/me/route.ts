/**
 * GET /api/v1/me
 * Returns the authenticated user's profile.
 * Requires: Authorization: Bearer fp_...
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/apiKeyAuth';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function GET(req: NextRequest) {
  const userId = await validateApiKey(req);
  if (!userId) {
    return NextResponse.json({ success: false, error: 'Unauthorized', message: 'Invalid or missing API key' }, { status: 401 });
  }

  const { data: profile, error } = await supabaseAdmin
    .from('profiles')
    .select('id, full_name, email, business_name, created_at')
    .eq('id', userId)
    .single();

  if (error || !profile) {
    return NextResponse.json({ success: false, error: 'Not found', message: 'User profile not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: profile });
}
