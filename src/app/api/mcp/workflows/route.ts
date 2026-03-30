/**
 * GET /api/mcp/workflows
 * Returns workflow templates owned by the authenticated user's team.
 * Requires: Authorization: Bearer fp_...
 *
 * Note: Live workflow state lives in n8n directly. This endpoint returns
 * the portal's workflow template library. To see active workflows, use
 * the n8n instance URL with the instance's own API key.
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

  // Fetch workflow templates for this user's team
  let query = supabaseAdmin
    .from('workflow_templates')
    .select('id, name, description, category, icon, is_public, is_active, import_count, created_at, updated_at')
    .order('created_at', { ascending: false });

  // Filter by team if instanceId context is provided — otherwise return all user templates
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('team_id')
    .eq('id', userId)
    .single();

  if (profile?.team_id) {
    query = query.or(`team_id.eq.${profile.team_id},is_public.eq.true`);
  } else {
    query = query.or(`created_by.eq.${userId},is_public.eq.true`);
  }

  if (instanceId) {
    // Filter to imports for this specific instance
    const { data: imports } = await supabaseAdmin
      .from('workflow_template_imports')
      .select('template_id')
      .eq('instance_id', instanceId)
      .eq('user_id', userId);

    const importedIds = (imports ?? []).map(i => i.template_id);
    if (importedIds.length > 0) {
      query = query.in('id', importedIds);
    }
  }

  const { data: workflows, error } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, error: 'Database error', message: 'Failed to fetch workflows' },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, workflows: workflows ?? [] });
}
