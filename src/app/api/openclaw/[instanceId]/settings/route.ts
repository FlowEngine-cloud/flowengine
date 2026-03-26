/**
 * PATCH /api/openclaw/[instanceId]/settings
 * Updates OpenClaw settings (model, channel tokens) in Supabase.
 * Note: Unlike the FlowEngine version, this does not trigger a Coolify redeploy.
 * The instance will pick up new settings on next restart.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { isValidUUID } from '@/lib/validation';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  const { instanceId } = await params;

  if (!isValidUUID(instanceId)) {
    return NextResponse.json({ error: 'Invalid instance ID' }, { status: 400 });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

  // Verify access
  const { data: instance, error: fetchError } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, openclaw_primary_model, openclaw_channel_tokens')
    .eq('id', instanceId)
    .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
    .maybeSingle();

  if (fetchError || !instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  const body = await req.json();
  const { primaryModel, channelTokens } = body;

  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (primaryModel !== undefined) updates.openclaw_primary_model = primaryModel?.trim() || null;
  if (channelTokens !== undefined) updates.openclaw_channel_tokens = JSON.stringify(channelTokens);

  const { error: updateError } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .update(updates)
    .eq('id', instanceId);

  if (updateError) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }

  return NextResponse.json({ message: 'Settings updated successfully.' });
}
