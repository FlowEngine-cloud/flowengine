/**
 * Agency Stripe Subscriptions API
 *
 * GET /api/agency/subscriptions - List subscriptions from agency's Stripe
 * GET /api/agency/subscriptions?id=sub_xxx - Get specific subscription details
 *
 * Used by:
 * - Agency: To select which subscription to link to a client
 * - Client dashboard: To display billing status
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
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

export async function GET(req: NextRequest) {
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

    const subscriptionId = req.nextUrl.searchParams.get('id');
    const agencyId = req.nextUrl.searchParams.get('agency_id');

    // Determine which agency's Stripe to use
    let targetAgencyId = user.id;

    // If agency_id is provided, this is a client viewing their subscription
    if (agencyId) {
      // Verify the client belongs to this agency
      const { data: clientInstance } = await supabaseAdmin
        .from('client_instances')
        .select('agency_id')
        .eq('client_id', user.id)
        .eq('agency_id', agencyId)
        .single();

      if (!clientInstance) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }

      targetAgencyId = agencyId;
    }

    const stripe = await getAgencyStripeClient(targetAgencyId);

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not connected', connected: false },
        { status: 400 }
      );
    }

    // If specific subscription requested
    if (subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
          expand: ['items.data.price.product'],
        }) as Stripe.Subscription;

        const price = subscription.items.data[0]?.price;
        const product = price?.product as Stripe.Product | undefined;

        return NextResponse.json({
          subscription: {
            id: subscription.id,
            status: subscription.status,
            currentPeriodEnd: (subscription as any).current_period_end,
            currentPeriodStart: (subscription as any).current_period_start,
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
            amount: price?.unit_amount ? price.unit_amount / 100 : null,
            currency: price?.currency || 'usd',
            interval: price?.recurring?.interval || 'month',
            productName: product?.name || 'Subscription',
          },
        });
      } catch (stripeError: any) {
        console.error('Failed to fetch subscription:', stripeError.message);
        return NextResponse.json(
          { error: 'Subscription not found' },
          { status: 404 }
        );
      }
    }

    // List all active subscriptions (for agency to choose from)
    try {
      const subscriptions = await stripe.subscriptions.list({
        status: 'active',
        limit: 100,
        expand: ['data.items.data.price.product', 'data.customer'],
      });

      const formattedSubscriptions = subscriptions.data.map((sub) => {
        const price = sub.items.data[0]?.price;
        const product = price?.product as Stripe.Product | undefined;
        const customer = sub.customer as Stripe.Customer;

        return {
          id: sub.id,
          status: sub.status,
          customerEmail: customer?.email || null,
          customerName: customer?.name || null,
          amount: price?.unit_amount ? price.unit_amount / 100 : null,
          currency: price?.currency || 'usd',
          interval: price?.recurring?.interval || 'month',
          productName: product?.name || 'Subscription',
          currentPeriodEnd: (sub as any).current_period_end,
        };
      });

      return NextResponse.json({
        subscriptions: formattedSubscriptions,
      });
    } catch (stripeError: any) {
      console.error('Failed to list subscriptions:', stripeError.message);
      return NextResponse.json(
        { error: 'Failed to fetch subscriptions from Stripe' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Subscriptions API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
