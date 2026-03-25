import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// GET /api/widget-studio/categories - List user's categories
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get user's owned instances AND instances where user is agency (both models)
    const [{ data: userInstances }, { data: agencyInstances }, { data: clientPaysInstances }] = await Promise.all([
      // Instances user owns directly
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, instance_name')
        .eq('user_id', effectiveUserId)
        .not('status', 'eq', 'deleted')
        .order('created_at', { ascending: false }),
      // Agency-paid model: instances via client_instances table
      supabaseAdmin
        .from('client_instances')
        .select('instance_id, pay_per_instance_deployments!inner(id, instance_name)')
        .eq('invited_by', effectiveUserId)
        .order('created_at', { ascending: false }),
      // Client-pays model: instances where user is the inviting agency
      supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('id, instance_name')
        .eq('invited_by_user_id', effectiveUserId)
        .not('status', 'eq', 'deleted')
        .order('created_at', { ascending: false }),
    ]);

    const ownedInstances = userInstances || [];
    const agencyInstancesList = agencyInstances?.map(a => ({
      id: a.instance_id,
      instance_name: (a.pay_per_instance_deployments as any)?.instance_name || 'Unknown'
    })) || [];
    const clientPaysInstancesList = clientPaysInstances || [];

    // Combine and deduplicate
    const allInstanceIds = [...new Set([
      ...ownedInstances.map(i => i.id),
      ...agencyInstancesList.map(i => i.id),
      ...clientPaysInstancesList.map(i => i.id)
    ])];
    const allInstances = [
      ...ownedInstances,
      ...agencyInstancesList.filter(a => !ownedInstances.some(o => o.id === a.id)),
      ...clientPaysInstancesList.filter(c => !ownedInstances.some(o => o.id === c.id) && !agencyInstancesList.some(a => a.id === c.id))
    ];

    // Fetch categories for user (owns directly) or via instances they have access to
    let categoriesQuery = supabaseAdmin
      .from('widget_categories')
      .select(`
        *,
        instance:pay_per_instance_deployments(id, instance_name)
      `)
      .order('display_order', { ascending: true });

    if (allInstanceIds.length > 0) {
      categoriesQuery = categoriesQuery.or(`user_id.eq.${effectiveUserId},instance_id.in.(${allInstanceIds.join(',')})`);
    } else {
      categoriesQuery = categoriesQuery.eq('user_id', effectiveUserId);
    }

    const { data: categories, error } = await categoriesQuery;

    if (error) {
      console.error('Error fetching categories:', error);
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
    }

    // Find instances without categories
    const categoryInstanceIds = categories?.map(c => c.instance_id).filter(Boolean) || [];
    const instancesWithoutCategory = allInstances.filter(i => !categoryInstanceIds.includes(i.id));

    return NextResponse.json({
      categories,
      instancesWithoutCategory
    });
  } catch (error) {
    console.error('Categories GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/widget-studio/categories - Create a new category
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Rate limiting: 20 category creations per minute per user
    const rateLimitResult = checkRateLimit(`category-create:${user.id}`, 20, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const body = await request.json();
    const { name, description, color, instance_id } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Category name is required' }, { status: 400 });
    }

    // If instance_id provided, verify user has access (owner or agency)
    if (instance_id) {
      if (!isValidUUID(instance_id)) {
        return NextResponse.json({ error: 'Invalid instance ID' }, { status: 400 });
      }

      const [{ data: instance }, { data: clientInstance }] = await Promise.all([
        supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('id, user_id, invited_by_user_id')
          .eq('id', instance_id)
          .maybeSingle(),
        supabaseAdmin
          .from('client_instances')
          .select('invited_by')
          .eq('instance_id', instance_id)
          .maybeSingle(),
      ]);

      const isInstanceOwner = instance?.user_id === effectiveUserId;
      const isAgencyPaid = clientInstance?.invited_by === effectiveUserId;
      const isClientPays = instance?.invited_by_user_id === effectiveUserId;

      if (!instance) {
        return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
      }

      if (!isInstanceOwner && !isAgencyPaid && !isClientPays) {
        return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
      }
    }

    // Get the max display_order for this user
    const { data: maxOrderResult } = await supabaseAdmin
      .from('widget_categories')
      .select('display_order')
      .eq('user_id', effectiveUserId)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextOrder = (maxOrderResult?.display_order ?? -1) + 1;

    const { data: category, error } = await supabaseAdmin
      .from('widget_categories')
      .insert({
        user_id: effectiveUserId,
        name: name.trim().substring(0, 50),
        description: description?.trim().substring(0, 200) || null,
        color: color || '#6366f1',
        display_order: nextOrder,
        instance_id: instance_id || null,
      })
      .select(`
        *,
        instance:pay_per_instance_deployments(id, instance_name)
      `)
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 });
    }

    return NextResponse.json({ category }, { status: 201 });
  } catch (error) {
    console.error('Categories POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
