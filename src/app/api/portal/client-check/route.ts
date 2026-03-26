import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: Request) {
  const token = request.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ isClient: false, instances: [] });

  const { data: { user } } = await supabaseAdmin.auth.getUser(token);
  if (!user) return NextResponse.json({ isClient: false, instances: [] });

  const { data } = await supabaseAdmin
    .from('client_instances')
    .select('instance_id, invited_by, access_level')
    .eq('user_id', user.id);

  const instances = data || [];

  // Full access = access_level of 'edit' or 'admin'
  const allowFullAccess = instances.some(
    (i) => i.access_level === 'edit' || i.access_level === 'admin'
  );

  return NextResponse.json({
    isClient: instances.length > 0,
    allowFullAccess,
    instances,
  });
}
