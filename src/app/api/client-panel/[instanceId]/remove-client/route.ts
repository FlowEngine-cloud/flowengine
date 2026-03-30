import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Remove client access from an instance
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const { instanceId } = await params;

    // Validate UUID format
    if (!isValidUUID(instanceId)) {
      return NextResponse.json({ error: 'Invalid instance ID format' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Rate limit: 10 removals per hour
    const rateLimitResult = checkRateLimit(`remove-client:${user.id}`, 10, 60 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Verify user owns this instance OR is agency manager via invited_by_user_id
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id')
      .eq('id', instanceId)
      .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
      .maybeSingle();

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found or access denied' }, { status: 403 });
    }

    // Get client instance to know which client's UI components to delete
    const { data: clientInstance } = await supabaseAdmin
      .from('client_instances')
      .select('id, user_id')
      .eq('instance_id', instanceId)
      .maybeSingle();

    if (clientInstance) {
      // delete components created by the client for this instance
      const { error: widgetDeleteError } = await supabaseAdmin
        .from('client_widgets')
        .delete()
        .eq('instance_id', instanceId)
        .eq('created_by', clientInstance.user_id);

      if (widgetDeleteError) {
        console.error('Failed to delete client widgets:', widgetDeleteError);
        // Continue anyway - UI components are not critical
      }

      // Remove client instance record
      const { error: deleteClientError } = await supabaseAdmin
        .from('client_instances')
        .delete()
        .eq('id', clientInstance.id);

      if (deleteClientError) {
        console.error('Failed to remove client instance:', deleteClientError);
      }
    }

    // Delete invites for this instance
    // For agency-paid (Flow 1): invite has instance_id set
    // For client-paid (Flow 2): invite has instance_id = null, but accepted_by = client
    // We need to handle both cases

    // First, try to delete by instance_id (Flow 1 - agency pays)
    const { error: deleteByInstanceError } = await supabaseAdmin
      .from('client_invites')
      .delete()
      .eq('instance_id', instanceId)
      .eq('invited_by', effectiveUserId);

    if (deleteByInstanceError) {
      console.error('Failed to remove invites by instance_id:', deleteByInstanceError);
    }

    // Also delete by accepted_by if we have the client's user_id (Flow 2 - client pays)
    // This handles invites where instance_id was never set (client paid via Stripe)
    if (clientInstance?.user_id) {
      const { error: deleteByAcceptedError } = await supabaseAdmin
        .from('client_invites')
        .delete()
        .eq('accepted_by', clientInstance.user_id)
        .eq('invited_by', effectiveUserId)
        .is('instance_id', null); // Only delete client-paid invites (instance_id is null)

      if (deleteByAcceptedError) {
        console.error('Failed to remove invites by accepted_by:', deleteByAcceptedError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Remove client error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
