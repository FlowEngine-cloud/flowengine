/**
 * Client Templates API
 * GET - List available workflow templates for the client with credential status
 */

import { NextRequest, NextResponse } from 'next/server';
import { fetchN8nCredentials, extractCredentialsFromWorkflows } from '@/lib/n8nInstanceApi';
import { checkCredentialStatus, CredentialWithStatus } from '@/lib/n8n/credentialExtractor';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Initialize Supabase client with service role

interface TemplateWithStatus {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  icon: string | null;
  agency_name: string;
  required_credentials: CredentialWithStatus[];
  can_import: boolean;
  import_count: number;
  created_at: string;
  updated_at: string;
  version: number;
  changelog: string | null;
}

/**
 * GET /api/client/templates?instanceId=xxx
 * List available templates for the client with credential status
 */
export async function GET(request: NextRequest) {
  try {
    // Get auth token from header
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify user session
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Get instance ID from query params
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');

    if (!instanceId) {
      return NextResponse.json({ error: 'instanceId is required' }, { status: 400 });
    }

    // Get instance and verify client has access — check pay_per_instance first, fall back to n8n_instances
    let instance: any = null;

    const { data: payPerInstance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, instance_url, n8n_api_key, user_id, invited_by_user_id, subscription_status')
      .eq('id', instanceId)
      .maybeSingle();

    if (payPerInstance) {
      instance = payPerInstance;
    } else {
      // Fallback: dedicated instance (n8n_instances table)
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('id, instance_url, n8n_api_key, user_id')
        .eq('id', instanceId)
        .eq('user_id', effectiveUserId)
        .neq('status', 'deleted')
        .maybeSingle();

      if (dedicatedInstance) {
        instance = {
          ...dedicatedInstance,
          subscription_status: 'active',
        };
      }
    }

    if (!instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Check if user is a client of this instance
    const { data: clientAccess } = await supabaseAdmin
      .from('client_instances')
      .select('invited_by')
      .eq('instance_id', instanceId)
      .eq('user_id', effectiveUserId)
      .maybeSingle();

    // Determine agency ID (who owns the templates)
    let agencyId: string | null = null;

    if (clientAccess) {
      // User is a client - get templates from the agency that invited them
      agencyId = clientAccess.invited_by;
    } else if (instance.user_id === effectiveUserId) {
      // User is the owner - they might also be testing as a client
      // In this case, show their own templates
      agencyId = effectiveUserId;
    } else {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    if (!agencyId) {
      return NextResponse.json({ error: 'No agency found' }, { status: 404 });
    }

    // Fetch templates from the agency
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from('workflow_templates')
      .select('*')
      .eq('user_id', agencyId)
      .eq('is_active', true)
      .eq('assignment_type', 'all') // Phase A: only "all" assignments
      .order('created_at', { ascending: false });

    if (templatesError) {
      console.error('Error fetching templates:', templatesError);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    // Get agency name
    const { data: agencyProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', agencyId)
      .single();

    const agencyName = agencyProfile?.full_name || agencyProfile?.email?.split('@')[0] || 'Agency';

    // If no templates, return empty array
    if (!templates || templates.length === 0) {
      return NextResponse.json({ templates: [] });
    }

    // Fetch user's credentials from n8n (if instance has API key)
    let userCredentials: Array<{ id: string; name: string; type: string }> = [];

    if (instance.n8n_api_key && ['active', 'trialing'].includes(instance.subscription_status)) {
      const { credentials, error: credError } = await fetchN8nCredentials(
        instance.instance_url,
        instance.n8n_api_key
      );

      if (!credError && credentials.length > 0) {
        userCredentials = credentials;
      } else {
        // Fallback: extract credentials from workflow nodes
        // This is needed when n8n API returns 405 for GET /credentials
        console.log('[templates] Credentials API failed, extracting from workflows...');
        const { credentials: extractedCreds } = await extractCredentialsFromWorkflows(
          instance.instance_url,
          instance.n8n_api_key
        );

        if (extractedCreds.length > 0) {
          userCredentials = extractedCreds;
        }
      }

      // Also include credentials from local records (created via client portal)
      // This ensures credentials not yet connected to workflows are still detected
      const { data: localCredentials } = await supabaseAdmin
        .from('credential_records')
        .select('n8n_credential_id, type, name')
        .eq('instance_id', instanceId);

      if (localCredentials && localCredentials.length > 0) {
        const existingIds = new Set(userCredentials.map(c => c.id));
        for (const localCred of localCredentials) {
          if (!existingIds.has(localCred.n8n_credential_id)) {
            userCredentials.push({
              id: localCred.n8n_credential_id,
              type: localCred.type,
              name: localCred.name,
            });
          }
        }
      }

      console.log('[templates] Credentials for matching:', userCredentials.map(c => ({ type: c.type, name: c.name })));
    }

    // Process templates with credential status
    const templatesWithStatus: TemplateWithStatus[] = templates.map(template => {
      const requiredCredentials = template.required_credentials || [];
      console.log('[templates] Template:', template.name, 'requires:', requiredCredentials.map((c: any) => c.type));

      // Check status of each required credential
      const credentialsWithStatus = checkCredentialStatus(
        requiredCredentials.map((c: any) => ({
          type: c.type,
          name: c.name,
          icon: c.icon || 'key',
          docUrl: c.docUrl || '',
          nodeTypes: c.nodeTypes || [],
        })),
        userCredentials
      );

      const canImport = credentialsWithStatus.every(c => c.status === 'available');

      return {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        icon: template.icon,
        agency_name: agencyName,
        required_credentials: credentialsWithStatus,
        can_import: canImport,
        import_count: template.import_count || 0,
        created_at: template.created_at,
        updated_at: template.updated_at,
        version: template.version || 1,
        changelog: template.changelog || null,
      };
    });

    return NextResponse.json({ templates: templatesWithStatus });
  } catch (error) {
    console.error('Error in GET /api/client/templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
