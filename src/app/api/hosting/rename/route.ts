import { NextRequest, NextResponse } from 'next/server';
import { getEffectiveOwnerId } from '@/lib/teamUtils';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

/**
 * PATCH /api/hosting/rename
 * Rename a portal instance (pay_per_instance_deployments).
 */
export async function PATCH(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { instanceId, newName } = body;

    if (!instanceId || typeof instanceId !== 'string') {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }
    if (!newName || typeof newName !== 'string' || !newName.trim()) {
      return NextResponse.json({ error: 'newName is required' }, { status: 400 });
    }

    const trimmedName = newName.trim().substring(0, 50);
    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);

    const { data, error } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .update({ instance_name: trimmedName })
      .eq('id', instanceId)
      .or(`user_id.eq.${ctx.ownerId},invited_by_user_id.eq.${ctx.ownerId}`)
      .select('id, instance_name')
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: 'Instance not found or permission denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true, instance: data });
  } catch (error) {
    console.error('[hosting/rename] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
