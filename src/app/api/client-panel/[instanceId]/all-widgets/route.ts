import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET: Get all UI components owned by the agency (across all instances)
export async function GET(
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

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Check if user owns the instance, is agency manager, or is agency via client_instances
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('user_id, invited_by_user_id')
      .eq('id', instanceId)
      .maybeSingle();

    const { data: clientInstance } = await supabaseAdmin
      .from('client_instances')
      .select('user_id, invited_by')
      .eq('instance_id', instanceId)
      .maybeSingle();

    const isOwner = instance?.user_id === effectiveUserId;
    const isAgencyManager = instance?.invited_by_user_id === effectiveUserId; // user-invites-agency flow
    const isAgencyViaClientInstances = clientInstance?.invited_by === effectiveUserId; // agency-invites-client flow
    const isClient = clientInstance?.user_id === effectiveUserId && !isOwner && !isAgencyManager && !isAgencyViaClientInstances;

    // Clients cannot access all agency widgets
    if (isClient) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!isOwner && !isAgencyManager && !isAgencyViaClientInstances) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Get all instances owned by this user
    const { data: userInstances } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, instance_name')
      .eq('user_id', effectiveUserId);

    // Get all instances where user is the agency
    const { data: agencyInstances } = await supabaseAdmin
      .from('client_instances')
      .select('instance_id, instance:pay_per_instance_deployments(id, instance_name)')
      .eq('invited_by', effectiveUserId);

    // Combine instance IDs
    const instanceIds = new Set<string>();
    userInstances?.forEach(i => instanceIds.add(i.id));
    agencyInstances?.forEach(ci => {
      if (ci.instance_id) instanceIds.add(ci.instance_id);
    });

    // Get all UI components: either owned directly by user OR assigned to user's instances
    // Also exclude drafts (UI components with __DRAFT__ prefix in name)
    let query = supabaseAdmin
      .from('client_widgets')
      .select('*, instance:pay_per_instance_deployments(id, instance_name)')
      .not('name', 'like', '__DRAFT__%')
      .order('created_at', { ascending: false });

    if (instanceIds.size > 0) {
      // User owns directly OR instance is in user's instances
      query = query.or(`user_id.eq.${effectiveUserId},instance_id.in.(${Array.from(instanceIds).join(',')})`);
    } else {
      // Only directly owned widgets
      query = query.eq('user_id', effectiveUserId);
    }

    const { data: widgets, error } = await query;

    if (error) {
      console.error('Failed to fetch widgets:', error);
      return NextResponse.json({ error: 'Failed to fetch widgets' }, { status: 500 });
    }

    // Fetch client emails for assigned instances
    const widgetInstanceIds = [...new Set(
      (widgets || []).filter(w => w.instance_id).map(w => w.instance_id as string)
    )];
    let instanceClientMap = new Map<string, string>();
    if (widgetInstanceIds.length > 0) {
      const { data: clientLinks } = await supabaseAdmin
        .from('client_instances')
        .select('instance_id, profiles!client_instances_user_id_fkey(email)')
        .in('instance_id', widgetInstanceIds);
      for (const link of clientLinks || []) {
        const email = (link.profiles as { email?: string } | null)?.email;
        if (email) instanceClientMap.set(link.instance_id, email);
      }
    }

    const enrichedWidgets = (widgets || []).map(w => ({
      ...w,
      instance: w.instance ? { ...w.instance, client_email: instanceClientMap.get(w.instance_id) ?? null } : w.instance,
    }));

    return NextResponse.json({ widgets: enrichedWidgets });
  } catch (error) {
    console.error('All widgets error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
