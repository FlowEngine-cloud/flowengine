/**
 * POST /api/n8n/update-ai-payer
 * Update the ai_payer field on a specific n8n instance deployment.
 * Controls whether the agency or the client's budget is consumed for AI calls.
 *
 * Body: { instanceId: string, aiPayer: 'agency' | 'client' }
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { isValidUUID } from '@/lib/validation';

export async function POST(req: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: { get: (name: string) => cookieStore.get(name)?.value } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const body = await req.json().catch(() => ({}));
    const { instanceId, aiPayer } = body;

    if (!instanceId || !isValidUUID(instanceId)) {
      return NextResponse.json({ success: false, error: 'Valid instanceId is required' }, { status: 400 });
    }
    if (aiPayer !== 'agency' && aiPayer !== 'client') {
      return NextResponse.json({ success: false, error: 'aiPayer must be "agency" or "client"' }, { status: 400 });
    }

    // Verify the agency owns this instance (via user_id or invited_by_user_id)
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, invited_by_user_id')
      .eq('id', instanceId)
      .is('deleted_at', null)
      .single();

    if (!instance) {
      return NextResponse.json({ success: false, error: 'Instance not found' }, { status: 404 });
    }

    const isOwner = instance.user_id === effectiveUserId;
    const isInviter = instance.invited_by_user_id === effectiveUserId;

    if (!isOwner && !isInviter) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // When switching to 'client', the instance must have a linked client user
    if (aiPayer === 'client' && !instance.user_id) {
      return NextResponse.json(
        { success: false, error: 'Cannot set client as payer: no client linked to this instance' },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .update({ ai_payer: aiPayer })
      .eq('id', instanceId);

    if (updateError) {
      console.error('[API:N8N:UPDATE-AI-PAYER]', updateError);
      return NextResponse.json({ success: false, error: 'Failed to update AI payer' }, { status: 500 });
    }

    return NextResponse.json({ success: true, instanceId, aiPayer });
  } catch (error) {
    console.error('[API:N8N:UPDATE-AI-PAYER]', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
