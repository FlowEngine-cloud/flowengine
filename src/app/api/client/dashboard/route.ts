import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


export async function GET(req: NextRequest) {
  try {
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

    // Check for preview mode (agency previewing client view)
    const { searchParams } = new URL(req.url);
    const previewInstanceId = searchParams.get('preview');

    // Preview mode: Agency owner or manager previewing how client sees their dashboard
    if (previewInstanceId && isValidUUID(previewInstanceId)) {
      // SECURITY: First fetch the instance WITHOUT user filter, then explicitly verify access
      let instance: any = null;
      let isDedicated = false;

      const { data: payPerInstance } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('*')
        .eq('id', previewInstanceId)
        .maybeSingle();

      if (payPerInstance) {
        instance = payPerInstance;
      } else {
        // Fallback: check dedicated instances (n8n_instances table)
        const { data: dedicatedInstance } = await supabaseAdmin
          .from('n8n_instances')
          .select('*')
          .eq('id', previewInstanceId)
          .eq('user_id', effectiveUserId)
          .neq('status', 'deleted')
          .maybeSingle();

        if (dedicatedInstance) {
          instance = dedicatedInstance;
          isDedicated = true;
        }
      }

      // SECURITY: Instance must exist
      if (!instance) {
        return NextResponse.json({
          error: 'Access denied',
          message: 'Instance not found.'
        }, { status: 403 });
      }

      // SECURITY: Explicit authorization check - user must be owner OR inviter
      const isOwner = instance.user_id === effectiveUserId;
      const isInviter = instance.invited_by_user_id === effectiveUserId;

      if (!isOwner && !isInviter) {
        console.warn(`[SECURITY] Unauthorized preview attempt: user=${user.id} tried to access instance=${previewInstanceId}`);
        return NextResponse.json({
          error: 'Access denied',
          message: 'You do not have access to this instance.'
        }, { status: 403 });
      }

      // Fetch profile and widgets with individual error handling
      let profile: any = null;
      let widgets: any[] = [];

      try {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('full_name, agency_logo_url, tier')
          .eq('id', effectiveUserId)
          .maybeSingle();
        profile = data;
      } catch (error) {
        console.error('Failed to fetch profile for preview:', error);
      }

      try {
        const { data } = await supabaseAdmin
          .from('client_widgets')
          .select('*')
          .eq('instance_id', previewInstanceId)
          .not('name', 'like', '__DRAFT__%')
          .order('display_order', { ascending: true });
        widgets = data || [];
      } catch (error) {
        console.error('Failed to fetch widgets for preview:', error);
      }

      // Use the already-verified instance
      const ownedInstance = instance;

      const isProPlus = true; // Open-source portal: all users get full features

      // Determine allowFullAccess based on INSTANCE TYPE (not who is previewing):
      // - Client-owned: user_id = client, invited_by_user_id = agency → client pays → FULL ACCESS
      // - Agency-owned: user_id = agency, client in client_instances → agency pays → check allow_full_access
      //
      // To detect instance type: if user_id != invited_by_user_id, it's client-owned
      const instanceIsClientOwned = ownedInstance.invited_by_user_id &&
                                    ownedInstance.user_id !== ownedInstance.invited_by_user_id;

      // For agency-owned instances, check client_instances for allow_full_access
      let allowFullAccess = instanceIsClientOwned; // Client-owned always has full access
      let clientIdForKeyCheck: string | null = null;

      if (!instanceIsClientOwned) {
        // Agency-owned - check if there's a client with allow_full_access
        // (Preview mode doesn't know which client, so default to false)
        allowFullAccess = false;

        // Get the first linked client
        const { data: clientLink } = await supabaseAdmin
          .from('client_instances')
          .select('user_id')
          .eq('instance_id', previewInstanceId)
          .limit(1)
          .maybeSingle();
        clientIdForKeyCheck = clientLink?.user_id || null;
      } else {
        // Client-owned: client is the user_id
        clientIdForKeyCheck = ownedInstance.user_id;
      }

      // Check instance status and include warnings for agency owner preview
      let instanceWarning: string | null = null;
      if (ownedInstance.deleted_at) {
        instanceWarning = 'This instance has been deleted. Clients cannot access it.';
      } else if (ownedInstance.subscription_status !== 'active' && ownedInstance.subscription_status !== 'trialing') {
        instanceWarning = `Instance subscription is ${ownedInstance.subscription_status}. Clients cannot access it until reactivated.`;
      }

      return NextResponse.json({
        instance: {
          id: ownedInstance.id,
          name: ownedInstance.instance_name,
          url: ownedInstance.instance_url,
          status: ownedInstance.status,
          storageLimitGb: ownedInstance.storage_limit_gb,
          subscriptionStatus: ownedInstance.subscription_status,
          currentPeriodEnd: ownedInstance.current_period_end,
          createdAt: ownedInstance.created_at,
          hasApiKey: !!ownedInstance.n8n_api_key, // Whether n8n API key is configured
          isExternal: !!ownedInstance.is_external, // BYON - client brings own n8n
        },
        invitedBy: profile?.full_name || 'Your Agency',
        agencyLogoUrl: isProPlus ? profile?.agency_logo_url : null,
        allowFullAccess, // Based on instance type and client settings
        widgets: widgets || [],
        isPreview: true, // Flag to indicate preview mode
        canRemoveWatermark: isProPlus, // Only Pro+ can remove watermark
        instanceWarning, // Alert agency if instance is unavailable to clients
        isClientOwned: instanceIsClientOwned, // Let frontend know if this is a client-paid instance
        isDedicated, // True = included with plan, no separate billing
        aiPayer: ownedInstance.ai_payer || 'agency', // Who pays for AI usage
        hasLinkedClient: !!clientIdForKeyCheck, // Whether a client is linked to this instance
      });
    }

    // Check for specific instanceId in query params
    const instanceId = searchParams.get('instanceId');

    // Get instances from client sources ONLY:
    // 1. Client-owned instances (user_id = current user, invited_by_user_id set) - "user invites agency" flow
    // 2. Agency-owned instances via client_instances table - "agency invites client" flow
    // NOTE: User's own instances (no agency) are NOT included - those use /portal/[id] only

    // Fetch with individual error handling to prevent Promise.all() failures
    let clientOwnedInstances: any[] | null = null;
    let clientInstanceRecords: any[] | null = null;

    try {
      const { data } = await supabaseAdmin
        .from('pay_per_instance_deployments')
        .select('*')
        .eq('user_id', effectiveUserId)
        .not('invited_by_user_id', 'is', null)
        .is('deleted_at', null);
      clientOwnedInstances = data;
    } catch (error) {
      console.error('Failed to fetch client-owned instances:', error);
      clientOwnedInstances = [];
    }

    try {
      const { data } = await supabaseAdmin
        .from('client_instances')
        .select('instance_id, invited_by, allow_full_access')
        .eq('user_id', effectiveUserId);
      clientInstanceRecords = data;
    } catch (error) {
      console.error('Failed to fetch client instance records:', error);
      clientInstanceRecords = [];
    }

    // Fetch agency-owned instances from client_instances
    let agencyOwnedInstances: any[] = [];
    if (clientInstanceRecords && clientInstanceRecords.length > 0) {
      const instanceIds = clientInstanceRecords.map(ci => ci.instance_id);

      try {
        const { data: instances } = await supabaseAdmin
          .from('pay_per_instance_deployments')
          .select('*')
          .in('id', instanceIds)
          .is('deleted_at', null);

        // Add allow_full_access and invited_by from client_instances
        agencyOwnedInstances = (instances || []).map(inst => {
          const clientRecord = clientInstanceRecords.find(ci => ci.instance_id === inst.id);
          return {
            ...inst,
            invited_by_user_id: clientRecord?.invited_by || inst.user_id,
            allow_full_access: clientRecord?.allow_full_access ?? false,
            isAgencyOwned: true // Flag to distinguish from client-owned
          };
        });
      } catch (error) {
        console.error('Failed to fetch agency-owned instances:', error);
        agencyOwnedInstances = [];
      }
    }

    // Merge all sources, avoiding duplicates
    const seenIds = new Set<string>();
    const allInstances: any[] = [];

    // 1. Add client-owned instances (user paid, invited agency)
    for (const inst of (clientOwnedInstances || [])) {
      if (!seenIds.has(inst.id)) {
        seenIds.add(inst.id);
        allInstances.push({ ...inst, isAgencyOwned: false, isUserOwned: false, allow_full_access: true });
      }
    }

    // 2. Add agency-owned instances (agency invited user as client)
    for (const inst of agencyOwnedInstances) {
      if (!seenIds.has(inst.id)) {
        seenIds.add(inst.id);
        allInstances.push(inst);
      }
    }

    // 3. Add dedicated instances (n8n_instances table — included with Pro+ plan)
    try {
      const { data: dedicatedInstances } = await supabaseAdmin
        .from('n8n_instances')
        .select('*')
        .eq('user_id', effectiveUserId)
        .neq('status', 'deleted');

      for (const inst of (dedicatedInstances || [])) {
        if (!seenIds.has(inst.id)) {
          seenIds.add(inst.id);
          allInstances.push({
            ...inst,
            // Normalize fields to match pay_per_instance_deployments shape
            instance_name: inst.instance_name || inst.name || 'Dedicated Instance',
            instance_url: inst.instance_url || inst.url,
            subscription_status: 'active', // Dedicated instances are always active (included with plan)
            storage_limit_gb: inst.storage_limit_gb || 50,
            isAgencyOwned: false,
            isUserOwned: true,
            isDedicated: true,
            allow_full_access: true,
          });
        }
      }
    } catch (error) {
      console.error('Failed to fetch dedicated instances:', error);
    }

    const totalInstanceCount = allInstances?.length || 0;

    // If no instances at all, return 404
    if (!allInstances || allInstances.length === 0) {
      return NextResponse.json({
        error: 'Client instance not found',
        message: `No client access found for ${user.email}.`
      }, { status: 404 });
    }

    // Filter to specific instance if requested (ignore empty strings)
    const instances = instanceId && instanceId.trim()
      ? allInstances.filter(i => i.id === instanceId)
      : allInstances;

    // If instanceId was provided but not found, fall back gracefully
    // (user may have bookmarked an old URL or access was revoked)
    let effectiveInstances = instances;
    let invalidInstanceId = false;

    if (instanceId && instances.length === 0 && allInstances.length > 0) {
      invalidInstanceId = true;
      effectiveInstances = allInstances; // Use all instances instead
    }

    // If multiple instances (or invalid instanceId with multiple), show selector
    if (effectiveInstances.length > 1 && (!instanceId || invalidInstanceId)) {
      // Fetch agency profiles for all instances (filter out null invited_by_user_id for user-owned instances)
      const agencyIds = [...new Set(effectiveInstances.map(i => i.invited_by_user_id).filter(Boolean))];

      // Also fetch user's own profile for user-owned instances
      const profilesToFetch = [...agencyIds];
      if (!profilesToFetch.includes(effectiveUserId)) {
        profilesToFetch.push(effectiveUserId);
      }

      const { data: profiles } = await supabaseAdmin
        .from('profiles')
        .select('id, full_name, agency_logo_url, tier')
        .in('id', profilesToFetch);

      const profileMap: Record<string, { name: string; logoUrl: string | null }> = {};
      profiles?.forEach(p => {
        profileMap[p.id] = {
          name: p.full_name || 'Agency',
          logoUrl: p.agency_logo_url || null
        };
      });

      return NextResponse.json({
        multipleInstances: true,
        invalidInstanceId, // Let frontend know to clear URL
        instances: effectiveInstances.map(inst => {
          const isUserOwned = inst.isUserOwned === true;
          const ownerId = isUserOwned ? effectiveUserId : inst.invited_by_user_id;
          return {
            id: inst.id,
            name: inst.instance_name,
            storageLimitGb: inst.storage_limit_gb,
            status: inst.status,
            isUserOwned, // Flag to show "Your Instance" badge
            isExternal: !!inst.is_external, // BYON - client brings own n8n
            agencyName: isUserOwned ? 'Your Instance' : (profileMap[ownerId]?.name || 'Agency'),
            agencyLogoUrl: profileMap[ownerId]?.logoUrl || null
          };
        })
      });
    }

    // Use first (or only) instance
    const instance = effectiveInstances[0];

    // Fetch agency profile and UI components with individual error handling
    // Guard against null invited_by_user_id (edge case: orphaned records or data inconsistency)
    const agencyId = instance.invited_by_user_id || instance.user_id;

    let agencyProfile: any = null;
    let widgets: any[] = [];

    if (agencyId) {
      try {
        const { data } = await supabaseAdmin
          .from('profiles')
          .select('full_name, agency_logo_url, tier')
          .eq('id', agencyId)
          .maybeSingle();
        agencyProfile = data;
      } catch (error) {
        console.error('Failed to fetch agency profile:', error);
      }
    }

    try {
      const { data } = await supabaseAdmin
        .from('client_widgets')
        .select('*')
        .eq('instance_id', instance.id)
        .not('name', 'like', '__DRAFT__%')
        .order('display_order', { ascending: true });
      widgets = data || [];
    } catch (error) {
      console.error('Failed to fetch widgets:', error);
    }

    const isProPlus = true; // Open-source portal: all users get full features

    return NextResponse.json({
      instance: {
        id: instance.id,
        name: instance.instance_name,
        url: instance.instance_url,
        status: instance.status,
        storageLimitGb: instance.storage_limit_gb,
        subscriptionStatus: instance.subscription_status,
        currentPeriodEnd: instance.current_period_end,
        createdAt: instance.created_at,
        hasApiKey: !!instance.n8n_api_key, // Whether n8n API key is configured
        isExternal: !!instance.is_external, // BYON - client brings own n8n
      },
      invitedBy: agencyProfile?.full_name || 'Your Agency',
      agencyLogoUrl: isProPlus ? agencyProfile?.agency_logo_url : null,
      allowFullAccess: instance.allow_full_access ?? true,
      isClientOwned: !instance.isAgencyOwned, // True = client paid, False = agency paid
      isDedicated: !!instance.isDedicated, // True = included with plan, no separate billing
      widgets: widgets || [],
      canRemoveWatermark: isProPlus,
      totalInstanceCount, // For "Switch Panel" button visibility
      aiPayer: instance.ai_payer || 'agency', // Who pays for AI usage
      hasLinkedClient: true, // Client is viewing their own portal, so client is always linked
    });
  } catch (error) {
    console.error('Client dashboard error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
