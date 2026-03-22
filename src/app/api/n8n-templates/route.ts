/**
 * API Routes for Agency Workflow Templates
 * GET - List all templates for the authenticated agency
 * POST - Create a new template
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractRequiredCredentials } from '@/lib/n8n/credentialExtractor';
import { emailService, AgencySmtpConfig } from '@/lib/emailService';
import { APP_URL } from '@/lib/config';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Initialize Supabase client with service role for admin operations

/**
 * GET /api/n8n-templates
 * List all workflow templates for the authenticated agency
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

    // Get user's team_id from profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('team_id')
      .eq('id', user.id)
      .single();

    const teamId = profile?.team_id;

    // Fetch templates for this user's team
    let query = supabaseAdmin
      .from('workflow_templates')
      .select('*')
      .order('created_at', { ascending: false });

    if (teamId) {
      query = query.eq('team_id', teamId);
    } else {
      query = query.eq('created_by', user.id);
    }

    let { data: templates, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching templates:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch templates' }, { status: 500 });
    }

    // If no templates found, check if user is a client and fetch their agency's templates
    if (!templates || templates.length === 0) {
      const { data: clientLink } = await supabaseAdmin
        .from('client_instances')
        .select('invited_by')
        .eq('user_id', user.id)
        .limit(1);

      if (clientLink && clientLink.length > 0) {
        const agencyId = clientLink[0].invited_by;
        const { data: agencyProfile } = await supabaseAdmin
          .from('profiles')
          .select('team_id')
          .eq('id', agencyId)
          .single();

        let agencyQuery = supabaseAdmin
          .from('workflow_templates')
          .select('*')
          .order('created_at', { ascending: false });

        if (agencyProfile?.team_id) {
          agencyQuery = agencyQuery.eq('team_id', agencyProfile.team_id);
        } else {
          agencyQuery = agencyQuery.eq('created_by', agencyId);
        }

        const { data: agencyTemplates, error: agencyError } = await agencyQuery;

        if (!agencyError && agencyTemplates) {
          templates = agencyTemplates;
        }
      }
    }

    // Format response
    const formattedTemplates = (templates || []).map(template => ({
      id: template.id,
      name: template.name,
      description: template.description,
      category: template.category,
      icon: template.icon,
      required_credentials: template.required_credentials || [],
      import_count: template.import_count || 0,
      is_active: template.is_active,
      created_at: template.created_at,
      updated_at: template.updated_at,
      version: template.version || 1,
      changelog: template.changelog || null,
    }));

    return NextResponse.json({ templates: formattedTemplates });
  } catch (error) {
    console.error('Error in GET /api/n8n-templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * POST /api/n8n-templates
 * Create a new workflow template
 */
export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const { name, description, category, icon, workflow_json, notify_clients } = body;

    // Validate required fields
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (!workflow_json || typeof workflow_json !== 'object') {
      return NextResponse.json({ error: 'Workflow JSON is required' }, { status: 400 });
    }

    // Validate workflow structure
    if (!workflow_json.nodes || !Array.isArray(workflow_json.nodes)) {
      return NextResponse.json({ error: 'Invalid workflow: nodes array is required' }, { status: 400 });
    }

    if (workflow_json.nodes.length === 0) {
      return NextResponse.json({ error: 'Invalid workflow: at least one node is required' }, { status: 400 });
    }

    // If notify_clients is requested, validate SMTP is configured and fetch settings for later use
    let validatedSmtpSettings: {
      smtp_host: string;
      smtp_port: number | null;
      smtp_user: string;
      smtp_pass_encrypted: string;
      sender_email: string | null;
    } | null = null;

    if (notify_clients) {
      const { data: smtpSettings } = await supabaseAdmin
        .from('agency_smtp_settings')
        .select('smtp_host, smtp_port, smtp_user, smtp_pass_encrypted, sender_email')
        .eq('user_id', user.id)
        .single();

      if (!smtpSettings?.smtp_host || !smtpSettings?.smtp_user || !smtpSettings?.smtp_pass_encrypted) {
        return NextResponse.json({
          error: 'SMTP not configured',
          message: 'Please configure your SMTP email provider in Settings before sending notifications to clients.',
          code: 'SMTP_NOT_CONFIGURED'
        }, { status: 400 });
      }

      validatedSmtpSettings = smtpSettings;
    }

    // Extract required credentials from workflow
    const extractedCredentials = extractRequiredCredentials(workflow_json);

    // Get user's team_id from profile
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('team_id')
      .eq('id', user.id)
      .single();

    // Insert template into database
    const { data: template, error: insertError } = await supabaseAdmin
      .from('workflow_templates')
      .insert({
        team_id: profile?.team_id || null,
        created_by: user.id,
        name: name.trim(),
        description: description?.trim() || null,
        category: category?.trim() || null,
        icon: icon || null,
        workflow_json,
        required_credentials: extractedCredentials.map(c => ({
          type: c.type,
          name: c.name,
          icon: c.icon,
          docUrl: c.docUrl,
        })),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating template:', insertError);
      return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
    }

    // Send email notifications to clients if requested
    let emailsSent = 0;
    if (notify_clients && validatedSmtpSettings) {
      try {
        // Get agency profile for name
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, business_name')
          .eq('id', user.id)
          .single();

        const agencyName = profile?.business_name || profile?.full_name || 'Your Agency';

        // Use already-validated SMTP settings
        const agencySmtp: AgencySmtpConfig = {
          host: validatedSmtpSettings.smtp_host,
          port: validatedSmtpSettings.smtp_port || 587,
          user: validatedSmtpSettings.smtp_user,
          passEncrypted: validatedSmtpSettings.smtp_pass_encrypted,
          sender: validatedSmtpSettings.sender_email || validatedSmtpSettings.smtp_user,
        };

        // Get all clients for this agency (via client_instances)
        const { data: clientInstances } = await supabaseAdmin
          .from('client_instances')
          .select(`
            user_id,
            instance_id,
            profiles!client_instances_user_id_fkey(email)
          `)
          .eq('invited_by', user.id);

        if (clientInstances && clientInstances.length > 0) {
          // Get unique client emails
          const clientEmails = new Set<string>();
          for (const ci of clientInstances) {
            const email = (ci.profiles as any)?.email;
            if (email) clientEmails.add(email);
          }

          // Send emails in parallel (with limit)
          const emailPromises = Array.from(clientEmails).map(async (email) => {
            try {
              // Get the instance ID for the dashboard URL
              const clientInstance = clientInstances.find(ci => (ci.profiles as any)?.email === email);
              const dashboardUrl = clientInstance?.instance_id
                ? `${APP_URL}/portal/${clientInstance.instance_id}`
                : `${APP_URL}/portal`;

              await emailService.sendNewTemplateNotification(
                email,
                template.name,
                template.description,
                agencyName,
                dashboardUrl,
                agencySmtp
              );
              return true;
            } catch (err) {
              console.error(`Failed to send new template email to ${email}:`, err);
              return false;
            }
          });

          const results = await Promise.all(emailPromises);
          emailsSent = results.filter(Boolean).length;
          console.log(`[new-template] Sent ${emailsSent}/${clientEmails.size} notification emails`);
        }
      } catch (emailError) {
        console.error('Error sending new template notifications:', emailError);
        // Don't fail the request if emails fail
      }
    }

    return NextResponse.json({
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        icon: template.icon,
        required_credentials: template.required_credentials,
        import_count: template.import_count,
        is_active: template.is_active,
        created_at: template.created_at,
        updated_at: template.updated_at,
      },
      extracted_credentials: extractedCredentials,
      emails_sent: emailsSent,
    }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/n8n-templates:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
