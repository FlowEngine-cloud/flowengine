import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createClient } from '@supabase/supabase-js';


/**
 * GET — Check if the user has a payment method on file.
 * Returns { hasCard, last4, brand } or { hasCard: false }.
 */
export async function GET(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authorization.replace('Bearer ', '');
    const supabaseAuth = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Get Stripe customer ID from profiles
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ hasCard: false });
    }

    // Check for default payment method
    const customer = await getStripe().customers.retrieve(profile.stripe_customer_id);
    if ('deleted' in customer && customer.deleted) {
      return NextResponse.json({ hasCard: false });
    }

    const defaultPm = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
    if (!defaultPm) {
      // Check if there are any payment methods attached
      const paymentMethods = await getStripe().paymentMethods.list({
        customer: profile.stripe_customer_id,
        type: 'card',
        limit: 1,
      });

      if (paymentMethods.data.length === 0) {
        return NextResponse.json({ hasCard: false });
      }

      const pm = paymentMethods.data[0];
      return NextResponse.json({
        hasCard: true,
        last4: pm.card?.last4 || '****',
        brand: pm.card?.brand || 'card',
        paymentMethodId: pm.id,
      });
    }

    // Default payment method exists
    const pm = typeof defaultPm === 'string'
      ? await getStripe().paymentMethods.retrieve(defaultPm)
      : defaultPm;

    return NextResponse.json({
      hasCard: true,
      last4: pm.card?.last4 || '****',
      brand: pm.card?.brand || 'card',
      paymentMethodId: pm.id,
    });
  } catch (error) {
    console.error('Check card error:', error);
    return NextResponse.json({ error: 'Failed to check payment method' }, { status: 500 });
  }
}

/**
 * POST — Create a subscription using the card on file (no Stripe redirect).
 * Body: { planType, billingCycle, instanceName?, storageLimit? }
 * Returns { success, subscriptionId } on success.
 */
export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authorization.replace('Bearer ', '');
    const supabaseAuth = createClient(
      process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { planType, billingCycle, instanceName, storageLimit } = await req.json();

    // Validate inputs
    if (!['pay_per_instance', 'whatsapp'].includes(planType)) {
      return NextResponse.json({ error: 'Invalid plan type for direct charge' }, { status: 400 });
    }
    if (!['monthly', 'annual'].includes(billingCycle)) {
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 });
    }

    // Get Stripe customer ID
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({ error: 'No Stripe customer found. Please add a payment method first.' }, { status: 400 });
    }

    // Verify payment method exists
    const customer = await getStripe().customers.retrieve(profile.stripe_customer_id);
    if ('deleted' in customer && customer.deleted) {
      return NextResponse.json({ error: 'Stripe customer not found' }, { status: 400 });
    }

    // Get default payment method or first available
    let paymentMethodId = (customer as Stripe.Customer).invoice_settings?.default_payment_method;
    if (!paymentMethodId) {
      const paymentMethods = await getStripe().paymentMethods.list({
        customer: profile.stripe_customer_id,
        type: 'card',
        limit: 1,
      });
      if (paymentMethods.data.length === 0) {
        return NextResponse.json({ error: 'No payment method on file. Please add a card first.' }, { status: 400 });
      }
      paymentMethodId = paymentMethods.data[0].id;
    }

    // Resolve price ID
    let priceId: string | undefined;

    if (planType === 'pay_per_instance') {
      if (!instanceName?.trim()) {
        return NextResponse.json({ error: 'Instance name is required' }, { status: 400 });
      }
      if (![10, 30, 50].includes(storageLimit)) {
        return NextResponse.json({ error: 'Invalid storage limit' }, { status: 400 });
      }

      const priceIdMap: Record<string, string | undefined> = {
        '10-monthly': process.env.NEXT_PUBLIC_STRIPE_10GB_MONTHLY_PRICE_ID,
        '10-annual': process.env.NEXT_PUBLIC_STRIPE_10GB_ANNUAL_PRICE_ID,
        '30-monthly': process.env.NEXT_PUBLIC_STRIPE_30GB_MONTHLY_PRICE_ID,
        '30-annual': process.env.NEXT_PUBLIC_STRIPE_30GB_ANNUAL_PRICE_ID,
        '50-monthly': process.env.NEXT_PUBLIC_STRIPE_50GB_MONTHLY_PRICE_ID,
        '50-annual': process.env.NEXT_PUBLIC_STRIPE_50GB_ANNUAL_PRICE_ID,
      };
      priceId = priceIdMap[`${storageLimit}-${billingCycle}`];
    } else if (planType === 'whatsapp') {
      priceId = billingCycle === 'annual'
        ? process.env.STRIPE_PRICE_WHATSAPP_ANNUAL
        : process.env.STRIPE_PRICE_WHATSAPP_MONTHLY;
    }

    if (!priceId) {
      return NextResponse.json({ error: 'Could not resolve pricing' }, { status: 400 });
    }

    // Create subscription with default payment method
    const subscription = await getStripe().subscriptions.create({
      customer: profile.stripe_customer_id,
      items: [{ price: priceId }],
      default_payment_method: typeof paymentMethodId === 'string' ? paymentMethodId : paymentMethodId.id,
      payment_behavior: 'error_if_incomplete',
      metadata: {
        supabase_user_id: user.id,
        user_id: user.id,
        plan_type: planType,
        billing_cycle: billingCycle,
        ...(planType === 'pay_per_instance' && {
          instance_name: instanceName,
          storage_limit: String(storageLimit),
          is_external: 'false',
        }),
      },
    });

    return NextResponse.json({
      success: true,
      subscriptionId: subscription.id,
      status: subscription.status,
    });
  } catch (error: any) {
    console.error('Direct charge error:', error);

    // Handle Stripe card errors specifically
    if (error.type === 'StripeCardError') {
      return NextResponse.json({ error: error.message || 'Card was declined' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 });
  }
}
