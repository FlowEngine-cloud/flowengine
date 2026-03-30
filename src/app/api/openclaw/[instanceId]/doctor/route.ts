/**
 * GET /api/openclaw/[instanceId]/doctor
 * Diagnostics are not available via the portal — requires direct server access.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { isValidUUID } from '@/lib/validation';

export async function GET(
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
  const { data: instance } = await supabaseAdmin
    .from('pay_per_instance_deployments')
    .select('id, instance_url')
    .eq('id', instanceId)
    .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
    .maybeSingle();

  if (!instance) {
    return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
  }

  return NextResponse.json({
    output: 'Full diagnostics require direct server access. Use the FlowEngine dashboard to run openclaw doctor.',
  });
}
