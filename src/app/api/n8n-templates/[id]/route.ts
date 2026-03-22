/**
 * API Routes for Individual Workflow Template
 * GET - Get a single template by ID
 * PUT - Update template metadata
 * DELETE - Soft delete (deactivate) template
 */

import { NextRequest, NextResponse } from 'next/server';
import { extractRequiredCredentials } from '@/lib/n8n/credentialExtractor';
import { emailService, AgencySmtpConfig } from '@/lib/emailService';
import { APP_URL } from '@/lib/config';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

// Initialize Supabase client with service role

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/n8n-templates/[id]
 * Get a single template by ID
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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

    // Fetch template (owned by user's team or created by user)
    let templateQuery = supabaseAdmin
      .from('workflow_templates')
      .select('*')
      .eq('id', id);

    if (teamId) {
      templateQuery = templateQuery.eq('team_id', teamId);
    } else {
      templateQuery = templateQuery.eq('created_by', user.id);
    }

    let { data: template } = await templateQuery.maybeSingle();

    // If not found, check if user is a client and fetch from their agency
    if (!template) {
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
          .eq('id', id);

        if (agencyProfile?.team_id) {
          agencyQuery = agencyQuery.eq('team_id', agencyProfile.team_id);
        } else {
          agencyQuery = agencyQuery.eq('created_by', agencyId);
        }

        const { data: agencyTemplate } = await agencyQuery.maybeSingle();

        if (agencyTemplate) {
          template = agencyTemplate;
        }
      }
    }

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({
      template: {
        id: template.id,
        name: template.name,
        description: template.description,
        category: template.category,
        icon: template.icon,
        workflow_json: template.workflow_json,
        required_credentials: template.required_credentials,
        import_count: template.import_count,
        is_active: template.is_active,
        version: template.version || 1,
        changelog: template.changelog,
        created_at: template.created_at,
        updated_at: template.updated_at,
      },
    });
  } catch (error) {
    console.error('Error in GET /api/n8n-templates/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PUT /api/n8n-templates/[id]
 * Update template metadata or workflow JSON
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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
    const { data: putProfile } = await supabaseAdmin
      .from('profiles')
      .select('team_id')
      .eq('id', user.id)
      .single();

    const putTeamId = putProfile?.team_id;

    // Check template exists and belongs to user's team
    let existingQuery = supabaseAdmin
      .from('workflow_templates')
      .select('id, created_by, version, workflow_json')
      .eq('id', id);

    if (putTeamId) {
      existingQuery = existingQuery.eq('team_id', putTeamId);
    } else {
      existingQuery = existingQuery.eq('created_by', user.id);
    }

    const { data: existing, error: checkError } = await existingQuery.single();

    if (checkError || !existing) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const { name, description, category, icon, workflow_json, is_active, changelog, notify_users } = body;

    // Build update object
    const updates: Record<string, any> = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description?.trim() || null;
    }

    if (category !== undefined) {
      updates.category = category?.trim() || null;
    }

    if (icon !== undefined) {
      updates.icon = icon || null;
    }

    if (is_active !== undefined) {
      updates.is_active = Boolean(is_active);
    }

    // Store validated SMTP settings for later use (declared outside if block for scope)
    let validatedSmtpSettings: {
      smtp_host: string;
      smtp_port: number | null;
      smtp_user: string;
      smtp_pass_encrypted: string;
      sender_email: string | null;
    } | null = null;

    // If workflow_json is updated, re-extract credentials and increment version
    if (workflow_json !== undefined) {
      if (!workflow_json || typeof workflow_json !== 'object') {
        return NextResponse.json({ error: 'Invalid workflow JSON' }, { status: 400 });
      }

      if (!workflow_json.nodes || !Array.isArray(workflow_json.nodes) || workflow_json.nodes.length === 0) {
        return NextResponse.json({ error: 'Invalid workflow: at least one node is required' }, { status: 400 });
      }

      // Require changelog when updating workflow (for versioning)
      if (!changelog || typeof changelog !== 'string' || changelog.trim().length === 0) {
        return NextResponse.json({
          error: 'Changelog is required when updating workflow',
          message: 'Please provide a brief description of what changed in this update.'
        }, { status: 400 });
      }

      // If notify_users is requested, validate SMTP is configured
      if (notify_users) {
        const { data: smtpSettings } = await supabaseAdmin
          .from('agency_smtp_settings')
          .select('smtp_host, smtp_port, smtp_user, smtp_pass_encrypted, sender_email')
          .eq('user_id', user.id)
          .single();

        if (!smtpSettings?.smtp_host || !smtpSettings?.smtp_user || !smtpSettings?.smtp_pass_encrypted) {
          return NextResponse.json({
            error: 'SMTP not configured',
            message: 'Please configure your SMTP email provider in Settings before sending notifications to users.',
            code: 'SMTP_NOT_CONFIGURED'
          }, { status: 400 });
        }

        validatedSmtpSettings = smtpSettings;
      }

      updates.workflow_json = workflow_json;

      // Store previous workflow for potential rollback
      updates.previous_workflow_json = existing.workflow_json;

      // Increment version
      const currentVersion = existing.version || 1;
      updates.version = currentVersion + 1;
      updates.changelog = changelog.trim();

      // Re-extract required credentials
      const extractedCredentials = extractRequiredCredentials(workflow_json);
      updates.required_credentials = extractedCredentials.map(c => ({
        type: c.type,
        name: c.name,
        icon: c.icon,
        docUrl: c.docUrl,
      }));
    }

    // If no updates, return current template
    if (Object.keys(updates).length === 0) {
      const { data: template } = await supabaseAdmin
        .from('workflow_templates')
        .select('*')
        .eq('id', id)
        .single();

      return NextResponse.json({ template });
    }

    // Update template
    const { data: template, error: updateError } = await supabaseAdmin
      .from('workflow_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating template:', updateError);
      return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
    }

    // Send email notifications to users who have this template imported
    let emailsSent = 0;
    const workflowWasUpdated = workflow_json !== undefined;
    if (notify_users && workflowWasUpdated && validatedSmtpSettings) {
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

        // Get all imports of this template that haven't been updated yet
        const { data: imports } = await supabaseAdmin
          .from('workflow_template_imports')
          .select(`
            id,
            imported_by,
            instance_id,
            installed_version,
            n8n_workflow_id,
            profiles!workflow_template_imports_imported_by_fkey(email),
            pay_per_instance_deployments!workflow_template_imports_instance_id_fkey(id)
          `)
          .eq('template_id', id)
          .lt('installed_version', template.version || 1);

        if (imports && imports.length > 0) {
          // Group by user email to avoid duplicate emails
          const userEmailMap = new Map<string, { email: string; instanceId: string; workflowId: string }>();
          for (const imp of imports) {
            const email = (imp.profiles as any)?.email;
            const instanceId = imp.instance_id;
            if (email && instanceId && !userEmailMap.has(email)) {
              userEmailMap.set(email, {
                email,
                instanceId,
                workflowId: imp.n8n_workflow_id,
              });
            }
          }

          // Send emails
          const emailPromises = Array.from(userEmailMap.values()).map(async ({ email, instanceId }) => {
            try {
              const dashboardUrl = `${APP_URL}/portal/${instanceId}`;
              await emailService.sendTemplateUpdateNotification(
                email,
                template.name,
                template.name, // workflow name (same as template for now)
                existing.version || 1,
                template.version || 2,
                template.changelog || 'Bug fixes and improvements',
                dashboardUrl,
                agencyName,
                agencySmtp
              );
              return true;
            } catch (err) {
              console.error(`Failed to send template update email to ${email}:`, err);
              return false;
            }
          });

          const results = await Promise.all(emailPromises);
          emailsSent = results.filter(Boolean).length;
          console.log(`[template-update] Sent ${emailsSent}/${userEmailMap.size} notification emails for template ${id}`);
        }
      } catch (emailError) {
        console.error('Error sending template update notifications:', emailError);
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
        version: template.version || 1,
        changelog: template.changelog,
        created_at: template.created_at,
        updated_at: template.updated_at,
      },
      emails_sent: emailsSent,
    });
  } catch (error) {
    console.error('Error in PUT /api/n8n-templates/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * DELETE /api/n8n-templates/[id]
 * Soft delete a template (set is_active = false)
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

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
    const { data: delProfile } = await supabaseAdmin
      .from('profiles')
      .select('team_id')
      .eq('id', user.id)
      .single();

    const delTeamId = delProfile?.team_id;

    // Check template exists and belongs to user's team
    let delQuery = supabaseAdmin
      .from('workflow_templates')
      .select('id, created_by')
      .eq('id', id);

    if (delTeamId) {
      delQuery = delQuery.eq('team_id', delTeamId);
    } else {
      delQuery = delQuery.eq('created_by', user.id);
    }

    const { data: delExisting, error: checkError } = await delQuery.single();

    if (checkError || !delExisting) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Soft delete (deactivate)
    const { error: deleteError } = await supabaseAdmin
      .from('workflow_templates')
      .update({ is_active: false })
      .eq('id', id);

    if (deleteError) {
      console.error('Error deleting template:', deleteError);
      return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/n8n-templates/[id]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
