import { NextRequest, NextResponse } from 'next/server';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;
function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    _client = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _client;
}

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
    const { data: { user }, error: authError } = await getSupabaseAdmin().auth.getUser(token);
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

    // Verify ownership and update
    const { data, error } = await getSupabaseAdmin()
      .from('pay_per_instance_deployments')
      .update({ instance_name: trimmedName })
      .or(`user_id.eq.${user.id},invited_by_user_id.eq.${user.id}`)
      .eq('id', instanceId)
      .select('id, instance_name')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Instance not found or permission denied' }, { status: 404 });
    }

    return NextResponse.json({ success: true, instance: data });
  } catch (error) {
    console.error('[hosting/rename] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
