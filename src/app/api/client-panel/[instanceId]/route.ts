import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getPortalSettings } from '@/lib/portalSettings';
import { createFlowEngineClient } from '@/lib/flowengine';


// GET: Get instance info and client access for agency's instance
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

    // Resolve effective user ID (team members act as team owner)
    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Check if user owns this instance OR is agency manager via invited_by_user_id
    // SECURITY: Exclude deleted instances
    const { data: instance, error: instanceError } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('*')
      .eq('id', instanceId)
      .is('deleted_at', null)
      .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
      .maybeSingle();

    // Also check for dedicated instances (n8n_instances / membership)
    let dedicatedInstance = null;
    if (!instance) {
      const { data: n8nInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('*')
        .eq('id', instanceId)
        .eq('user_id', effectiveUserId)
        .neq('status', 'deleted')
        .maybeSingle();

      if (n8nInstance) {
        dedicatedInstance = {
          id: n8nInstance.id,
          instance_name: n8nInstance.subdomain || 'Dedicated Instance',
          instance_url: n8nInstance.instance_url,
          status: n8nInstance.status,
          storage_limit_gb: n8nInstance.storage_limit_gb || 50,
          is_external: false, // Dedicated instances are never external
          isDedicated: true,
          n8n_api_key: n8nInstance.n8n_api_key ? '********' : null,
        };
      }
    }

    // If not found locally, try FlowEngine API (auto-link FlowEngine-hosted instances)
    if (!instanceError && !instance && !dedicatedInstance) {
      try {
        const settings = await getPortalSettings();
        if (settings.flowengine_api_key) {
          const feClient = createFlowEngineClient(settings.flowengine_api_key);
          const feInstance = await feClient.getInstance(instanceId).catch(() => null);
          if (feInstance && !feInstance.is_external) {
            // Auto-upsert a local shadow record so API keys etc. can be saved
            await supabaseAdmin.from('pay_per_instance_deployments').upsert({
              id: instanceId,
              user_id: effectiveUserId,
              instance_name: feInstance.instance_name,
              instance_url: feInstance.instance_url,
              status: feInstance.status,
              service_type: feInstance.service_type || 'n8n',
              is_external: false,
              hosting_mode: 'cloud',
              storage_limit_gb: feInstance.storage_gb || 10,
            }, { onConflict: 'id' });

            return NextResponse.json({
              instance: {
                id: instanceId,
                instance_name: feInstance.instance_name,
                instance_url: feInstance.instance_url,
                status: feInstance.status,
                storage_limit_gb: feInstance.storage_gb || 10,
                is_external: false,
                n8n_api_key: null,
              },
              client: null,
              isOwner: true,
              isAgencyManager: false,
              isDedicated: false,
              shouldUseClientPortal: false,
              allowFullAccess: true,
              instanceCategory: null,
              hasLinkedClient: false,
            });
          }
        }
      } catch {
        // FlowEngine API unavailable — fall through to normal 403
      }
    }

    if (instanceError || (!instance && !dedicatedInstance)) {
      // Check if user is the agency for a client instance via client_instances table
      const { data: clientInstance } = await supabaseAdmin
        .from('client_instances')
        .select(`
          *,
          instance:pay_per_instance_deployments(*)
        `)
        .eq('instance_id', instanceId)
        .eq('invited_by', effectiveUserId)
        .maybeSingle();

      // Check if the current user is a CLIENT of this instance (agency-invites-client flow)
      if (!clientInstance || !clientInstance.instance || clientInstance.instance.deleted_at) {
        const { data: myClientAccess } = await supabaseAdmin
          .from('client_instances')
          .select('allow_full_access, instance:pay_per_instance_deployments(id, instance_name, instance_url, status, storage_limit_gb, is_external, deleted_at)')
          .eq('instance_id', instanceId)
          .eq('user_id', effectiveUserId)
          .maybeSingle();

        const clientInst = myClientAccess?.instance as any;
        if (myClientAccess && clientInst && !clientInst.deleted_at) {
          return NextResponse.json({
            instance: {
              id: clientInst.id,
              instance_name: clientInst.instance_name,
              instance_url: clientInst.instance_url,
              status: clientInst.status,
              storage_limit_gb: clientInst.storage_limit_gb,
              is_external: clientInst.is_external || false,
              n8n_api_key: null, // clients do not manage the API key
            },
            client: null,
            isOwner: false,
            isAgencyManager: false,
            isDedicated: false,
            shouldUseClientPortal: true,
            allowFullAccess: myClientAccess.allow_full_access ?? false,
            instanceCategory: null,
            hasLinkedClient: false,
          });
        }

        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      // Get client info from invite + client profile for AI data
      const [{ data: invite }, { data: clientProfile }] = await Promise.all([
        supabaseAdmin
          .from('client_invites')
          .select('*')
          .eq('accepted_by', clientInstance.user_id)
          .eq('invited_by', effectiveUserId)
          .maybeSingle(),
        supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', clientInstance.user_id)
          .maybeSingle(),
      ]);

      return NextResponse.json({
        instance: {
          id: clientInstance.instance?.id,
          instance_name: clientInstance.instance?.instance_name,
          instance_url: clientInstance.instance?.instance_url,
          status: clientInstance.instance?.status,
          storage_limit_gb: clientInstance.instance?.storage_limit_gb,
          is_external: clientInstance.instance?.is_external || false,
        },
        client: invite ? {
          user_id: clientInstance.user_id,
          email: invite.email,
          status: invite.status,
          invite_id: invite.id,
          created_at: invite.created_at,
        } : clientProfile ? {
          user_id: clientInstance.user_id,
          email: clientProfile.email,
          status: 'accepted',
        } : null,
        isClientInstance: true,
        // AI data — needed for AI Tokens tab
        aiPayer: clientInstance.instance?.ai_payer || 'agency',
        hasLinkedClient: true,
      });
    }

    // Handle dedicated instances (n8n_instances / membership)
    if (dedicatedInstance) {
      return NextResponse.json({
        instance: dedicatedInstance,
        client: null, // Dedicated instances don't have client sharing
        isOwner: true,
        isAgencyManager: false,
        isClientPaid: false,
        isDedicated: true, // Flag to indicate this is a dedicated/personal instance
        shouldUseClientPortal: false, // Dedicated instances NEVER use client-portal
        allowFullAccess: true,
        instanceCategory: null,
      });
    }

    // User owns this instance directly - check if there's a client assigned or pending invite
    // First check client_instances (accepted invites)
    const { data: clientAccess } = await supabaseAdmin
      .from('client_instances')
      .select('*')
      .eq('instance_id', instanceId)
      .maybeSingle();

    // Get the instance category (for widget filtering)
    const { data: instanceCategory } = await supabaseAdmin
      .from('widget_categories')
      .select('id, name')
      .eq('user_id', effectiveUserId)
      .eq('instance_id', instanceId)
      .maybeSingle();

    // Also check for pending invites directly linked to this instance
    const { data: pendingInvite } = await supabaseAdmin
      .from('client_invites')
      .select('id, email, status, created_at')
      .eq('instance_id', instanceId)
      .eq('invited_by', effectiveUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // Determine ownership first (needed for clientInfo logic)
    const isOwner = instance.user_id === effectiveUserId;
    const isAgencyManager = instance.invited_by_user_id === effectiveUserId;
    // Client-paid = client owns instance AND agency manages it
    const isClientPaid = !!instance.invited_by_user_id && instance.user_id !== instance.invited_by_user_id;

    // Check if CURRENT USER has a client_instances record for this instance
    const { data: currentUserClientRecord } = await supabaseAdmin
      .from('client_instances')
      .select('id, allow_full_access')
      .eq('instance_id', instanceId)
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    // CRITICAL: Determine if current user should use client-portal for THIS instance
    // User should use client-portal if:
    // 1. They have a client_instances record (agency-paid OR client-paid with agency managing)
    // 2. OR they own the instance BUT agency manages (client-invited-agency flow)
    const shouldUseClientPortal = !!currentUserClientRecord || (isOwner && isClientPaid);

    // Determine client info based on flow type
    let clientInfo = null;

    if (isClientPaid && isAgencyManager) {
      // Client-invited-agency flow: client is the instance OWNER
      // Get owner's email from profiles
      const { data: ownerProfile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', instance.user_id)
        .maybeSingle();

      clientInfo = {
        user_id: instance.user_id,
        email: ownerProfile?.email || 'Unknown',
        status: 'accepted',
        invite_id: null,
        created_at: instance.created_at,
      };
    } else if (clientAccess) {
      // Agency-invites-client flow: client has accepted and is in client_instances
      let clientEmail = 'Unknown';
      const { data: clientProfile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('id', clientAccess.user_id)
        .maybeSingle();
      if (clientProfile?.email) {
        clientEmail = clientProfile.email;
      }

      clientInfo = {
        user_id: clientAccess.user_id,
        email: clientEmail,
        status: 'accepted',
        invite_id: null,
        created_at: clientAccess.created_at,
      };
    } else if (pendingInvite) {
      // Invite exists but not yet accepted
      clientInfo = {
        email: pendingInvite.email,
        status: pendingInvite.status,
        invite_id: pendingInvite.id,
        created_at: pendingInvite.created_at,
      };
    }


    return NextResponse.json({
      instance: {
        id: instance.id,
        instance_name: instance.instance_name,
        instance_url: instance.instance_url,
        status: instance.status,
        storage_limit_gb: instance.storage_limit_gb,
        is_external: instance.is_external || false,
        n8n_api_key: instance.n8n_api_key ? '********' : null,
      },
      client: clientInfo,
      isClientInstance: isAgencyManager, // Agency manager is managing client's instance
      isOwner,
      isAgencyManager,
      isClientPaid, // True when client owns instance and agency manages
      shouldUseClientPortal, // True if current user should see client-portal for this instance
      allowFullAccess: currentUserClientRecord?.allow_full_access ?? true,
      instanceCategory: instanceCategory || null,
      hasLinkedClient: !!clientInfo && clientInfo.status === 'accepted',
    });
  } catch (error) {
    console.error('Client panel error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
