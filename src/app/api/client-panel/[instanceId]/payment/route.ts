import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { isValidUUID, checkRateLimit } from '@/lib/validation';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
import { decryptApiKey } from '@/lib/encryption';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';


async function getAgencyStripeClient(agencyId: string): Promise<Stripe | null> {
  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('agency_stripe_key_encrypted')
      .eq('id', agencyId)
      .single();

    if (error || !profile?.agency_stripe_key_encrypted) {
      return null;
    }

    const apiKey = decryptApiKey(profile.agency_stripe_key_encrypted);
    if (!apiKey) return null;
    return new Stripe(apiKey);
  } catch (e) {
    console.error('Failed to get agency Stripe client:', e);
    return null;
  }
}

// GET: Get linked Stripe customer and their transactions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const { instanceId } = await params;

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

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Check if user is agency (owns instance OR is agency manager) or client (assigned to instance)
    let agencyId: string | null = null;
    let isAgency = false;
    let clientInstance: any = null;

    // First check if user owns this instance OR is agency manager
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, invited_by_user_id')
      .eq('id', instanceId)
      .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
      .maybeSingle();

    if (instance) {
      // User is either owner or agency manager
      agencyId = instance.invited_by_user_id === effectiveUserId ? effectiveUserId : instance.user_id;
      isAgency = true;

      // Get client instance for this instance
      const { data: ci } = await supabaseAdmin
        .from('client_instances')
        .select('id, agency_stripe_customer_id')
        .eq('instance_id', instanceId)
        .maybeSingle();
      clientInstance = ci;
    } else {
      // Check if user is assigned as client to this instance
      const { data: ci } = await supabaseAdmin
        .from('client_instances')
        .select('id, team_id, agency_stripe_customer_id')
        .eq('instance_id', instanceId)
        .eq('user_id', effectiveUserId)
        .maybeSingle();

      if (!ci) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }

      clientInstance = ci;
      agencyId = ci.team_id;
      isAgency = false;
    }

    // Check if agency has Stripe connected
    let hasStripeConnected = false;
    if (agencyId) {
      const { data: agencyProfile } = await supabaseAdmin
        .from('profiles')
        .select('agency_stripe_key_set')
        .eq('id', agencyId)
        .maybeSingle();
      hasStripeConnected = agencyProfile?.agency_stripe_key_set || false;
    }

    // Build response
    let stripeKeyError = false;
    let stripe: Stripe | null = null;
    if (hasStripeConnected && agencyId) {
      stripe = await getAgencyStripeClient(agencyId);
      if (!stripe) stripeKeyError = true;
    }

    const response: any = {
      stripeConnected: hasStripeConnected,
      stripeKeyError,
      isAgency,
      customerId: clientInstance?.agency_stripe_customer_id || null,
      customer: null,
      transactions: [],
    };

    // If customer is linked and Stripe is connected, fetch customer and transactions
    if (clientInstance?.agency_stripe_customer_id && stripe) {
        try {
          // Fetch customer details
          const customerResult = await stripe.customers.retrieve(clientInstance.agency_stripe_customer_id);
          if (!customerResult.deleted) {
            const customer = customerResult as Stripe.Customer;
            response.customer = {
              id: customer.id,
              email: customer.email,
              name: customer.name,
              created: customer.created,
            };
          }

          // Fetch payments/charges for this customer
          const charges = await stripe.charges.list({
            customer: clientInstance.agency_stripe_customer_id,
            limit: 50,
          });

          // Fetch invoices for this customer
          const invoices = await stripe.invoices.list({
            customer: clientInstance.agency_stripe_customer_id,
            limit: 50,
          });

          // Combine and sort by date
          const transactions: any[] = [];

          charges.data.forEach((charge) => {
            const normalizedStatus = charge.status === 'succeeded' ? 'paid'
              : charge.status === 'pending' ? 'pending'
              : charge.status === 'failed' ? 'failed'
              : charge.status;
            transactions.push({
              id: charge.id,
              type: 'payment',
              amount: charge.amount,
              currency: charge.currency,
              status: charge.status,
              normalizedStatus,
              description: charge.description || 'Payment',
              created: charge.created,
              receipt_url: charge.receipt_url,
              invoice_url: null,
            });
          });

          const now = Math.floor(Date.now() / 1000);
          invoices.data.forEach((invoice) => {
            let normalizedStatus = 'pending';
            if (invoice.status === 'paid') normalizedStatus = 'paid';
            else if (invoice.status === 'void' || invoice.status === 'uncollectible') normalizedStatus = 'void';
            else if (invoice.status === 'draft') normalizedStatus = 'draft';
            else if (invoice.status === 'open' && invoice.due_date && invoice.due_date < now) normalizedStatus = 'overdue';
            else if (invoice.status === 'open') normalizedStatus = 'pending';

            transactions.push({
              id: invoice.id,
              type: 'invoice',
              amount: invoice.amount_paid || invoice.total,
              currency: invoice.currency,
              status: invoice.status,
              normalizedStatus,
              description: invoice.description || `Invoice ${invoice.number || ''}`.trim(),
              created: invoice.created,
              receipt_url: null,
              invoice_url: invoice.hosted_invoice_url,
            });
          });

          // Sort by created date (newest first)
          transactions.sort((a, b) => b.created - a.created);
          response.transactions = transactions;

        } catch (stripeError) {
          console.error('Failed to fetch Stripe data:', stripeError);
          // Customer might have been deleted
          response.customer = null;
        }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Payment info error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST: Link a Stripe customer to the client
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const { instanceId } = await params;

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

    // Rate limit: max 10 customer links per minute per user (prevents Stripe API abuse)
    const rateLimitResult = checkRateLimit(`payment-link:${user.id}`, 10, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { customerId } = body;

    // Validate customer ID format
    if (customerId !== undefined && customerId !== null && customerId !== '') {
      if (typeof customerId !== 'string') {
        return NextResponse.json({ error: 'Invalid customer ID type' }, { status: 400 });
      }
      if (!customerId.startsWith('cus_')) {
        return NextResponse.json({ error: 'Invalid customer ID format' }, { status: 400 });
      }
    }

    // Verify user owns this instance or is invited agency (only agency can link)
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id, user_id, invited_by_user_id')
      .eq('id', instanceId)
      .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
      .maybeSingle();

    if (!instance) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Determine the agency ID (for Stripe key lookup)
    const agencyId = instance.invited_by_user_id === effectiveUserId
      ? effectiveUserId
      : instance.user_id;

    // Verify the customer exists in agency's Stripe
    if (customerId) {
      const stripe = await getAgencyStripeClient(agencyId);
      if (!stripe) {
        return NextResponse.json({ error: 'Stripe not connected' }, { status: 400 });
      }

      try {
        const customer = await stripe.customers.retrieve(customerId);
        if (customer.deleted) {
          return NextResponse.json({ error: 'Customer has been deleted' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'Customer not found in your Stripe account' }, { status: 400 });
      }
    }

    // Check if client instance exists
    const { data: clientInstance } = await supabaseAdmin
      .from('client_instances')
      .select('id')
      .eq('instance_id', instanceId)
      .maybeSingle();

    if (clientInstance) {
      // Update existing record
      const { error: updateError } = await supabaseAdmin
        .from('client_instances')
        .update({ agency_stripe_customer_id: customerId || null })
        .eq('instance_id', instanceId);

      if (updateError) {
        console.error('Failed to update customer link:', updateError);
        return NextResponse.json({ error: 'Failed to link customer' }, { status: 500 });
      }
    } else {
      // Create new client_instances record with just the Stripe customer
      const { error: insertError } = await supabaseAdmin
        .from('client_instances')
        .insert({
          team_id: effectiveUserId,
          instance_id: instanceId,
          invited_by: effectiveUserId,
          agency_stripe_customer_id: customerId || null,
        });

      if (insertError) {
        console.error('Failed to create customer link:', insertError);
        return NextResponse.json({ error: `Failed to link customer: ${insertError.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, customerId: customerId || null });
  } catch (error) {
    console.error('Link customer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Unlink the Stripe customer from the client
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ instanceId: string }> }
) {
  try {
    const { instanceId } = await params;

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

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    // Verify user owns this instance or is invited agency (only agency can unlink)
    const { data: instance } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('id')
      .eq('id', instanceId)
      .or(`user_id.eq.${effectiveUserId},invited_by_user_id.eq.${effectiveUserId}`)
      .maybeSingle();

    if (!instance) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Remove the customer link
    const { error: updateError } = await supabaseAdmin
      .from('client_instances')
      .update({ agency_stripe_customer_id: null })
      .eq('instance_id', instanceId);

    if (updateError) {
      console.error('Failed to unlink customer:', updateError);
      return NextResponse.json({ error: 'Failed to unlink customer' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unlink customer error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
