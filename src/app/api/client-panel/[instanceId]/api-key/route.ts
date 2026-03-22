import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, isExternalUrl, checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST: Save n8n API key for an instance
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

    // Rate limit: max 10 API key updates per minute per user
    const rateLimitResult = checkRateLimit(`api-key-update:${user.id}`, 10, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many API key updates. Please wait a moment.' },
        { status: 429 }
      );
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    const { apiKey, externalUrl } = await req.json();

    // Check pay-per-instance deployments first
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, instance_url, invited_by_user_id')
      .eq('id', instanceId)
      .maybeSingle();

    // If not found, check dedicated instances (n8n_instances table)
    let isDedicated = false;
    if (!instance) {
      const { data: dedicatedInstance } = await supabaseAdmin
        .from('n8n_instances')
        .select('id, user_id, instance_url')
        .eq('id', instanceId)
        .eq('user_id', effectiveUserId)
        .neq('status', 'deleted')
        .maybeSingle();

      if (!dedicatedInstance) {
        return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
      }
      isDedicated = true;
    } else {
      // For pay-per-instance: verify user is owner or agency
      let hasAccess = instance.user_id === effectiveUserId || instance.invited_by_user_id === effectiveUserId;

      if (!hasAccess) {
        const { data: clientInstance } = await supabaseAdmin
          .from('client_instances')
          .select('id')
          .eq('instance_id', instanceId)
          .eq('invited_by', effectiveUserId)
          .maybeSingle();

        hasAccess = !!clientInstance;
      }

      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Build update object with API key - PLAINTEXT (encryption disabled)
    const updateData: { n8n_api_key: string | null; instance_url?: string } = {
      n8n_api_key: apiKey,
    };

    // If external URL provided, use it instead of hosted URL
    if (externalUrl) {
      // Validate URL format and prevent SSRF
      const urlValidation = isExternalUrl(externalUrl);
      if (!urlValidation.valid) {
        return NextResponse.json({ error: urlValidation.error || 'Invalid external n8n URL' }, { status: 400 });
      }
      // Ensure HTTPS for production
      try {
        const parsedUrl = new URL(externalUrl);
        if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
          return NextResponse.json({ error: 'URL must use HTTP or HTTPS' }, { status: 400 });
        }
        updateData.instance_url = externalUrl;
      } catch {
        return NextResponse.json({ error: 'Invalid external n8n URL format' }, { status: 400 });
      }
    }

    // Update API key in the correct table
    const targetTable = isDedicated ? 'n8n_instances' : 'pay_per_instance_deployments';
    const { error: updateError } = await supabaseAdmin
      .from(targetTable)
      .update(updateData)
      .eq('id', instanceId);

    if (updateError) {
      console.error('Failed to update API key:', updateError);
      return NextResponse.json({ error: 'Failed to save API key' }, { status: 500 });
    }

    return NextResponse.json({ success: true, externalUrl: !!externalUrl });
  } catch (error) {
    console.error('API key save error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
