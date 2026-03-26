/**
 * DELETE /api/docker/instance?instanceId=...
 * Soft-delete a Docker/website instance and remove from Coolify if configured.
 */
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';

export async function DELETE(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const instanceId = searchParams.get('instanceId');

    if (!instanceId || !isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Valid instanceId is required' }, { status: 400 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, invited_by_user_id, coolify_service_id')
      .eq('id', instanceId)
      .is('deleted_at', null)
      .maybeSingle();

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Only the owner can delete
    if (instance.user_id !== effectiveUserId) {
      return NextResponse.json({ error: 'Access denied. Only the instance owner can delete.' }, { status: 403 });
    }

    // Try to remove from Coolify
    const coolifyToken = process.env.COOLIFY_API_TOKEN;
    const coolifyUrl = process.env.COOLIFY_API_URL;

    if (coolifyToken && coolifyUrl && instance.coolify_service_id) {
      try {
        await fetch(`${coolifyUrl}/api/v1/services/${instance.coolify_service_id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${coolifyToken}` },
        });
      } catch {
        // Continue with soft delete even if Coolify removal fails
      }
    }

    // Soft delete in DB
    await supabaseAdmin
      .from('pay_per_instance_deployments')
      .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
      .eq('id', instanceId);

    return NextResponse.json({ success: true, message: 'Instance deleted' });
  } catch (err) {
    console.error('[api/docker/instance DELETE]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
