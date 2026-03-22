import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


export async function POST(req: NextRequest) {
  try {
    const { priceId } = await req.json();
    console.log('[confirm-upgrade] Request received:', { priceId });

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

    // Get current subscription
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_subscription_id, stripe_price_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    if (!profile.stripe_subscription_id) {
      return NextResponse.json({ error: 'No active subscription found' }, { status: 400 });
    }

    // Get subscription from Stripe
    const subscription = await getStripe().subscriptions.retrieve(profile.stripe_subscription_id);

    // EDGE CASE 1: Check if subscription already has a schedule (pending change)
    if (subscription.schedule) {
      console.log('[confirm-upgrade] Canceling existing schedule:', subscription.schedule);
      // Cancel existing schedule to allow new change
      try {
        await getStripe().subscriptionSchedules.cancel(subscription.schedule as string);
      } catch (scheduleError) {
        console.error('[confirm-upgrade] Failed to cancel existing schedule:', scheduleError);
        // Continue anyway - schedule might already be released/canceled
      }
    }

    // EDGE CASE 2: Validate subscription is active
    if (subscription.status !== 'active' && subscription.status !== 'trialing') {
      console.error('[confirm-upgrade] Subscription is not active:', subscription.status);
      return NextResponse.json({ error: `Subscription is ${subscription.status}. Cannot modify.` }, { status: 400 });
    }

    // EDGE CASE 3: Check if already on the selected plan
    if (profile.stripe_price_id === priceId) {
      console.log('[confirm-upgrade] User already on this plan');
      return NextResponse.json({ error: "You're already on this plan" }, { status: 400 });
    }

    // EDGE CASE 5: Rate limit subscription changes to prevent coupon abuse
    // Check if subscription was recently modified (within last 24 hours)
    const subscriptionCreatedAt = subscription.created;
    const lastModified = (subscription as any).latest_invoice_created || subscriptionCreatedAt;
    const now = Math.floor(Date.now() / 1000);
    const hoursSinceLastChange = (now - lastModified) / 3600;
    const MINIMUM_HOURS_BETWEEN_CHANGES = 24;

    // Allow immediate changes if:
    // 1. User is on trial (first subscription setup)
    // 2. More than 24 hours have passed since last change
    // 3. This is their first change (subscription just created)
    const isOnTrial = subscription.status === 'trialing';
    const isFirstChange = subscriptionCreatedAt === lastModified;

    if (!isOnTrial && !isFirstChange && hoursSinceLastChange < MINIMUM_HOURS_BETWEEN_CHANGES) {
      const hoursRemaining = Math.ceil(MINIMUM_HOURS_BETWEEN_CHANGES - hoursSinceLastChange);
      console.warn('[confirm-upgrade] Rate limit hit - subscription changed too recently:', {
        userId: user.id,
        hoursSinceLastChange: hoursSinceLastChange.toFixed(2),
        hoursRemaining,
      });
      return NextResponse.json(
        {
          error: `To prevent abuse, you can only change your subscription once per 24 hours. Please try again in ${hoursRemaining} hour${hoursRemaining !== 1 ? 's' : ''}.`,
          rateLimited: true,
          retryAfterHours: hoursRemaining,
        },
        { status: 429 }
      );
    }

    // Get current and new price details to determine if upgrade or downgrade
    const currentPrice = await getStripe().prices.retrieve(profile.stripe_price_id);
    const newPrice = await getStripe().prices.retrieve(priceId);

    const currentAmount = currentPrice.unit_amount || 0;
    const newAmount = newPrice.unit_amount || 0;
    const isUpgrade = newAmount > currentAmount;

    // EDGE CASE 4: Validate price change is meaningful (not same price)
    if (currentAmount === newAmount) {
      console.error('[confirm-upgrade] Prices are identical');
      return NextResponse.json({ error: 'Cannot switch to plan with same price' }, { status: 400 });
    }

    console.log('[confirm-upgrade] Change type:', {
      isUpgrade,
      currentAmount,
      newAmount,
      currentPriceId: profile.stripe_price_id,
      newPriceId: priceId,
      hasExistingSchedule: !!subscription.schedule,
    });

    if (isUpgrade) {
      // UPGRADE: Apply immediately with prorations
      const updatedSubscription = await getStripe().subscriptions.update(subscription.id, {
        items: [
          {
            id: subscription.items.data[0].id,
            price: priceId,
          },
        ],
        proration_behavior: 'create_prorations',
      });

      console.log('[confirm-upgrade] Upgrade applied immediately:', {
        subscriptionId: updatedSubscription.id,
        newPriceId: priceId,
        status: updatedSubscription.status,
      });

      return NextResponse.json({
        success: true,
        isUpgrade: true,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
        },
      });
    } else {
      // DOWNGRADE: Schedule for end of current period
      const currentPeriodEnd = (subscription as any).current_period_end || subscription.billing_cycle_anchor;

      // Create subscription schedule to apply downgrade at period end
      const schedule = await getStripe().subscriptionSchedules.create({
        from_subscription: subscription.id,
      });

      // Update schedule to change price at period end
      const updatedSchedule = await getStripe().subscriptionSchedules.update(schedule.id, {
        phases: [
          {
            // Current phase - continues until period end
            items: [
              {
                price: profile.stripe_price_id,
                quantity: 1,
              },
            ],
            start_date: 'now', // Use 'now' to anchor the schedule
            end_date: currentPeriodEnd,
          },
          {
            // New phase - starts at period end with new price
            items: [
              {
                price: priceId,
                quantity: 1,
              },
            ],
            start_date: currentPeriodEnd,
          },
        ],
      });

      console.log('[confirm-upgrade] Downgrade scheduled for period end:', {
        scheduleId: updatedSchedule.id,
        effectiveDate: new Date(currentPeriodEnd * 1000).toISOString(),
        newPriceId: priceId,
      });

      return NextResponse.json({
        success: true,
        isUpgrade: false,
        scheduledFor: new Date(currentPeriodEnd * 1000).toISOString(),
        subscription: {
          id: subscription.id,
          status: subscription.status,
        },
      });
    }
  } catch (error: any) {
    console.error('Upgrade error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to upgrade subscription' },
      { status: 500 }
    );
  }
}
