import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { checkRateLimit } from '@/lib/validation';
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

// POST: Create a charge or invoice for a Stripe customer
export async function POST(req: NextRequest) {
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

    const rateLimitResult = checkRateLimit(`billing:${user.id}`, 5, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json({ error: 'Too many requests. Please wait a moment.' }, { status: 429 });
    }

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);

    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { action, customerId, amount, currency, description, interval, intervalCount } = body;

    if (!action || !customerId || !amount) {
      return NextResponse.json({ error: 'Missing required fields: action, customerId, amount' }, { status: 400 });
    }

    if (!['invoice', 'charge', 'subscription'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "invoice", "charge", or "subscription"' }, { status: 400 });
    }

    if (action === 'subscription') {
      if (!interval || !['day', 'week', 'month', 'year'].includes(interval)) {
        return NextResponse.json({ error: 'Invalid interval. Must be day, week, month, or year' }, { status: 400 });
      }
    }

    if (typeof amount !== 'number' || amount < 50) {
      return NextResponse.json({ error: 'Amount must be at least $0.50 (50 cents)' }, { status: 400 });
    }

    if (amount > 99999900) {
      return NextResponse.json({ error: 'Amount exceeds maximum allowed' }, { status: 400 });
    }

    if (typeof customerId !== 'string' || !customerId.startsWith('cus_')) {
      return NextResponse.json({ error: 'Invalid customer ID format' }, { status: 400 });
    }

    const stripe = await getAgencyStripeClient(effectiveUserId);
    if (!stripe) {
      return NextResponse.json({ error: 'Stripe not connected' }, { status: 400 });
    }

    // Verify customer exists
    try {
      const customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        return NextResponse.json({ error: 'Customer has been deleted' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Customer not found in your Stripe account' }, { status: 400 });
    }

    const useCurrency = (currency || 'usd').toLowerCase();

    if (action === 'invoice') {
      // Create and send a Stripe invoice
      const invoice = await stripe.invoices.create({
        customer: customerId,
        auto_advance: true, // Auto-finalize
        collection_method: 'send_invoice',
        days_until_due: 30,
      });

      // Add line item
      await stripe.invoiceItems.create({
        customer: customerId,
        invoice: invoice.id,
        amount,
        currency: useCurrency,
        description: description || 'Invoice',
      });

      // Finalize and send
      const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
      await stripe.invoices.sendInvoice(invoice.id);

      return NextResponse.json({
        success: true,
        type: 'invoice',
        invoiceId: finalizedInvoice.id,
        invoiceUrl: finalizedInvoice.hosted_invoice_url,
        status: finalizedInvoice.status,
      });
    }

    if (action === 'charge') {
      // Create a direct charge via PaymentIntent using customer's default payment method
      const customer = await stripe.customers.retrieve(customerId) as Stripe.Customer;
      const defaultPm = customer.invoice_settings?.default_payment_method
        || customer.default_source;

      if (!defaultPm) {
        return NextResponse.json({
          error: 'Customer has no default payment method on file. Send an invoice instead, or ask the customer to add a card in their Stripe portal.',
        }, { status: 400 });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency: useCurrency,
        customer: customerId,
        payment_method: typeof defaultPm === 'string' ? defaultPm : defaultPm.id,
        description: description || 'Charge',
        confirm: true,
        off_session: true,
      });

      // Try to get receipt URL from the resulting charge
      let receiptUrl: string | null = null;
      if (paymentIntent.latest_charge) {
        try {
          const chargeId = typeof paymentIntent.latest_charge === 'string'
            ? paymentIntent.latest_charge
            : paymentIntent.latest_charge.id;
          const charge = await stripe.charges.retrieve(chargeId);
          receiptUrl = charge.receipt_url || null;
        } catch { /* ignore */ }
      }

      return NextResponse.json({
        success: true,
        type: 'charge',
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        receiptUrl,
      });
    }

    if (action === 'subscription') {
      const count = Math.max(1, Math.min(12, parseInt(intervalCount || '1') || 1));

      // Create a price with the given interval
      const price = await stripe.prices.create({
        currency: useCurrency,
        unit_amount: amount,
        recurring: {
          interval: interval as 'day' | 'week' | 'month' | 'year',
          interval_count: count,
        },
        product_data: {
          name: description || 'Subscription',
        },
      });

      // Create the subscription for the customer
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: price.id }],
      });

      return NextResponse.json({
        success: true,
        type: 'subscription',
        subscriptionId: subscription.id,
        status: subscription.status,
        amount,
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Billing error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
