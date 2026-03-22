import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


// POST /api/widget-studio/templates/[id]/duplicate - Duplicate a template
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Validate UUID format
    if (!isValidUUID(id)) {
      return NextResponse.json({ error: 'Invalid template ID' }, { status: 400 });
    }

    // Fetch the original template
    const { data: original, error: fetchError } = await supabaseAdmin
      .from('client_widgets')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (fetchError || !original) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // Create the duplicate with "(Copy)" suffix
    const { data: duplicate, error: createError } = await supabaseAdmin
      .from('client_widgets')
      .insert({
        user_id: user.id,
        created_by: user.id,
        instance_id: original.instance_id,
        name: `${original.name} (Copy)`,
        widget_type: original.widget_type,
        form_fields: original.form_fields,
        webhook_url: original.webhook_url || '',
        styles: original.styles || {},
        is_active: true, // Make widget publicly accessible
      })
      .select(`
        *,
        instance:pay_per_instance_deployments(id, instance_name, user_id)
      `)
      .single();

    if (createError) {
      console.error('Error duplicating template:', createError);
      return NextResponse.json({ error: 'Failed to duplicate template' }, { status: 500 });
    }

    return NextResponse.json({ template: duplicate }, { status: 201 });
  } catch (error) {
    console.error('Template duplicate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
