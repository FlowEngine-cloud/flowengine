/**
 * GET /api/mcp/components
 * Returns UI embeds/widgets for the authenticated user.
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

  const { searchParams } = new URL(req.url);
  const instanceId = searchParams.get('instanceId');

  let query = supabaseAdmin
    .from('client_widgets')
    .select('id, name, description, widget_type, is_active, instance_id, created_at, updated_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (instanceId) {
    query = query.eq('instance_id', instanceId);
  }

  const { data: components, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: 'Database error', message: 'Failed to fetch components' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, components: components ?? [] });
}
