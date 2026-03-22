/**
 * Fetch active instance subscriptions from Stripe
 * Returns subscriptions that can be used to deploy n8n instances
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


export async function GET(req: NextRequest) {
  try {
    // Get the Authorization header
    const authorization = req.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Authorization header required' }, { status: 401 });
    }

    const token = authorization.substring(7);
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Fetch Stripe customer id
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.stripe_customer_id) {
      return NextResponse.json({
        subscriptions: [],
        message: 'No Stripe customer linked to profile'
      });
    }

    // Define instance price IDs
    const instancePrices = [
      process.env.NEXT_PUBLIC_STRIPE_10GB_MONTHLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_10GB_ANNUAL_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_50GB_MONTHLY_PRICE_ID,
      process.env.NEXT_PUBLIC_STRIPE_50GB_ANNUAL_PRICE_ID,
    ].filter(Boolean);

    // Get ALL subscriptions for this customer
    const subs = await getStripe().subscriptions.list({
      customer: profile.stripe_customer_id,
      status: 'all',
      limit: 50,
      expand: ['data.items.data.price'],
    });

    console.log(`[STRIPE-SUBS] User: ${user.id}, Customer: ${profile.stripe_customer_id}`);
    console.log(`[STRIPE-SUBS] Instance price IDs:`, instancePrices);
    console.log(`[STRIPE-SUBS] Total Stripe subscriptions: ${subs.data.length}`);

    // Filter to only instance subscriptions that are active or trialing
    const instanceSubs = subs.data.filter(s => {
      const priceId = s.items?.data?.[0]?.price?.id;
      const isInstance = priceId && instancePrices.includes(priceId);
      const isActive = s.status === 'active' || s.status === 'trialing';
      console.log(`[STRIPE-SUBS] Sub ${s.id}: priceId=${priceId}, isInstance=${isInstance}, isActive=${isActive}, status=${s.status}`);
      return isInstance && isActive;
    });

    console.log(`[STRIPE-SUBS] Filtered instance subs: ${instanceSubs.length}`);

    // Get existing deployments to see which subscriptions are already deployed
    const { data: deployments } = await supabaseAdmin
      .from('pay_per_instance_deployments')
      .select('stripe_subscription_id, deleted_at, status, id, instance_name')
      .eq('user_id', user.id);

    console.log(`[STRIPE-SUBS] DB deployments: ${deployments?.length || 0}`, deployments);

    // Map subscriptions with deployment status
    const result = instanceSubs.map(sub => {
      const priceId = sub.items?.data?.[0]?.price?.id;
      const deployment = deployments?.find(d => d.stripe_subscription_id === sub.id);

      // Determine storage size from price
      let storageGb = 10;
      if (priceId === process.env.NEXT_PUBLIC_STRIPE_50GB_MONTHLY_PRICE_ID ||
          priceId === process.env.NEXT_PUBLIC_STRIPE_50GB_ANNUAL_PRICE_ID) {
        storageGb = 50;
      }

      return {
        subscription_id: sub.id,
        status: sub.status,
        price_id: priceId,
        storage_gb: storageGb,
        current_period_end: (sub as any).current_period_end,
        created: sub.created,
        // Deployment info
        has_deployment: !!deployment,
        deployment_id: deployment?.id || null,
        deployment_name: deployment?.instance_name || null,
        deployment_deleted: !!deployment?.deleted_at,
        deployment_status: deployment?.status || null,
        // Can deploy if: no deployment OR deployment is deleted
        can_deploy: !deployment || !!deployment?.deleted_at,
      };
    });

    return NextResponse.json({
      subscriptions: result,
      total: result.length,
      deployable: result.filter(s => s.can_deploy).length,
    });

  } catch (e: any) {
    console.error('Error fetching instance subscriptions:', e);
    return NextResponse.json({ error: 'Failed to fetch subscriptions', details: e.message }, { status: 500 });
  }
}
