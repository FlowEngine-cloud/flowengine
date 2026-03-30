/**
 * Agency Billing Settings API
 *
 * GET  /api/agency/billing/settings?clientUserId=xxx - Get billing settings + manual payments for a client
 * PUT  /api/agency/billing/settings - Update billing settings for a client
 * POST /api/agency/billing/settings - Record a manual payment
 * DELETE /api/agency/billing/settings?id=xxx - Delete a manual payment
 */
import { NextRequest, NextResponse } from 'next/server';
import { isValidUUID, checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';


async function authenticate(req: NextRequest) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// GET: Fetch billing settings + manual payments for a client
export async function GET(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);
    const clientUserId = req.nextUrl.searchParams.get('clientUserId');

    if (!clientUserId || !isValidUUID(clientUserId)) {
      return NextResponse.json({ error: 'Valid clientUserId required' }, { status: 400 });
    }

    // Fetch settings and manual payments in parallel
    const [{ data: settings }, { data: manualPayments }] = await Promise.all([
      supabaseAdmin
        .from('agency_client_billing_settings')
        .select('*')
        .eq('agency_id', effectiveUserId)
        .eq('client_user_id', clientUserId)
        .maybeSingle(),
      supabaseAdmin
        .from('agency_manual_payments')
        .select('*')
        .eq('agency_id', effectiveUserId)
        .eq('client_user_id', clientUserId)
        .order('payment_date', { ascending: false }),
    ]);

    return NextResponse.json({
      settings: settings || {
        monthly_expected_amount: 0,
        currency: 'usd',
        notes: '',
      },
      manualPayments: manualPayments || [],
    });
  } catch (error) {
    console.error('Billing settings GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PUT: Update billing settings
export async function PUT(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rateLimitResult = checkRateLimit(`billing-settings:${user.id}`, 10, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { clientUserId, monthlyExpectedAmount, notes } = body;

    if (!clientUserId || !isValidUUID(clientUserId)) {
      return NextResponse.json({ error: 'Valid clientUserId required' }, { status: 400 });
    }

    if (monthlyExpectedAmount !== undefined && (typeof monthlyExpectedAmount !== 'number' || monthlyExpectedAmount < 0)) {
      return NextResponse.json({ error: 'Invalid monthly expected amount' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('agency_client_billing_settings')
      .upsert({
        agency_id: effectiveUserId,
        client_user_id: clientUserId,
        monthly_expected_amount: monthlyExpectedAmount ?? 0,
        notes: notes ?? '',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'agency_id,client_user_id' });

    if (error) {
      console.error('Failed to save billing settings:', error);
      return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Billing settings PUT error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Record a manual payment
export async function POST(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rateLimitResult = checkRateLimit(`manual-payment:${user.id}`, 10, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    let body;
    try { body = await req.json(); } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { clientUserId, amount, paymentMethod, description, paymentDate, reference } = body;

    if (!clientUserId || !isValidUUID(clientUserId)) {
      return NextResponse.json({ error: 'Valid clientUserId required' }, { status: 400 });
    }
    if (!amount || typeof amount !== 'number' || amount < 1) {
      return NextResponse.json({ error: 'Valid amount required (in cents)' }, { status: 400 });
    }
    if (!paymentMethod || !['bank_transfer', 'cash', 'check', 'crypto', 'other'].includes(paymentMethod)) {
      return NextResponse.json({ error: 'Valid payment method required' }, { status: 400 });
    }
    if (!paymentDate) {
      return NextResponse.json({ error: 'Payment date required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('agency_manual_payments')
      .insert({
        agency_id: effectiveUserId,
        client_user_id: clientUserId,
        amount,
        currency: 'usd',
        payment_method: paymentMethod,
        description: description || null,
        payment_date: paymentDate,
        reference: reference || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to record manual payment:', error);
      return NextResponse.json({ error: 'Failed to record payment' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Manual payment POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove a manual payment
export async function DELETE(req: NextRequest) {
  try {
    const user = await authenticate(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);
    const id = req.nextUrl.searchParams.get('id');

    if (!id || !isValidUUID(id)) {
      return NextResponse.json({ error: 'Valid payment ID required' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from('agency_manual_payments')
      .delete()
      .eq('id', id)
      .eq('agency_id', effectiveUserId);

    if (error) {
      console.error('Failed to delete manual payment:', error);
      return NextResponse.json({ error: 'Failed to delete payment' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Manual payment DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
