import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


export async function POST(req: NextRequest) {
  try {
    const { priceId } = await req.json();
    console.log('[preview-upgrade] Request received:', { priceId });

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

    // Get subscription from Stripe with expanded latest invoice
    const subscriptionData = await getStripe().subscriptions.retrieve(profile.stripe_subscription_id, {
      expand: ['latest_invoice'],
    });
    const subscription = subscriptionData as any;

    console.log('[preview-upgrade] Subscription:', {
      id: subscription.id,
      status: subscription.status,
      billing_cycle_anchor: subscription.billing_cycle_anchor,
    });

    // Get current and new price details
    const currentPrice = await getStripe().prices.retrieve(profile.stripe_price_id);
    const newPrice = await getStripe().prices.retrieve(priceId);

    // Calculate proration estimate
    const now = Math.floor(Date.now() / 1000);

    // Try to get period from multiple sources
    let periodEnd: number | undefined;
    let periodStart: number | undefined;

    // Method 1: Try subscription properties directly
    if (subscription.current_period_end && subscription.current_period_start) {
      periodEnd = subscription.current_period_end;
      periodStart = subscription.current_period_start;
      console.log('[preview-upgrade] Got period from subscription properties');
    }
    // Method 2: Get from latest invoice (with validation)
    else if (subscription.latest_invoice && typeof subscription.latest_invoice === 'object') {
      const invoice = subscription.latest_invoice;
      const invoicePeriodEnd = invoice.period_end;
      const invoicePeriodStart = invoice.period_start;

      // Validate invoice period data (must be reasonable - at least 1 day)
      const minimumPeriodLength = 24 * 60 * 60; // 1 day in seconds
      if (invoicePeriodEnd && invoicePeriodStart && (invoicePeriodEnd - invoicePeriodStart) >= minimumPeriodLength) {
        periodEnd = invoicePeriodEnd;
        periodStart = invoicePeriodStart;
        console.log('[preview-upgrade] Got period from latest invoice');
      } else {
        console.log('[preview-upgrade] Invoice period data is invalid, will try Method 3');
      }
    }
    // Method 3: Calculate from billing_cycle_anchor and price interval (fallback)
    if (!periodEnd || !periodStart) {
      if (subscription.billing_cycle_anchor) {
      const anchor = subscription.billing_cycle_anchor as number;
      const interval = currentPrice.recurring?.interval;
      const intervalCount = currentPrice.recurring?.interval_count || 1;

      // Calculate which billing period we're currently in
      const anchorDate = new Date(anchor * 1000);
      const currentDate = new Date(now * 1000);

      if (interval === 'month') {
        const months = intervalCount;
        // Calculate how many full periods have passed since anchor
        const monthsPassed = Math.floor(
          (currentDate.getFullYear() - anchorDate.getFullYear()) * 12 +
            currentDate.getMonth() -
            anchorDate.getMonth()
        );
        const currentPeriodIndex = Math.floor(monthsPassed / months);

        // Calculate current period start and end
        const periodStartDate = new Date(anchor * 1000);
        periodStartDate.setMonth(periodStartDate.getMonth() + currentPeriodIndex * months);
        periodStart = Math.floor(periodStartDate.getTime() / 1000);

        const periodEndDate = new Date(periodStartDate);
        periodEndDate.setMonth(periodEndDate.getMonth() + months);
        periodEnd = Math.floor(periodEndDate.getTime() / 1000);
      } else if (interval === 'year') {
        const years = intervalCount;
        // Calculate how many full periods have passed since anchor
        let yearsPassed = currentDate.getFullYear() - anchorDate.getFullYear();
        if (
          currentDate.getMonth() < anchorDate.getMonth() ||
          (currentDate.getMonth() === anchorDate.getMonth() && currentDate.getDate() < anchorDate.getDate())
        ) {
          yearsPassed--;
        }
        const currentPeriodIndex = Math.floor(yearsPassed / years);

        // Calculate current period start and end
        const periodStartDate = new Date(anchor * 1000);
        periodStartDate.setFullYear(periodStartDate.getFullYear() + currentPeriodIndex * years);
        periodStart = Math.floor(periodStartDate.getTime() / 1000);

        const periodEndDate = new Date(periodStartDate);
        periodEndDate.setFullYear(periodEndDate.getFullYear() + years);
        periodEnd = Math.floor(periodEndDate.getTime() / 1000);
      }
      console.log('[preview-upgrade] Calculated current period from billing_cycle_anchor');
      }
    }

    console.log('[preview-upgrade] Period calculation:', {
      periodEnd,
      periodStart,
      now,
      periodEndDate: periodEnd ? new Date(periodEnd * 1000).toISOString() : 'N/A',
      periodStartDate: periodStart ? new Date(periodStart * 1000).toISOString() : 'N/A',
    });

    if (!periodEnd || !periodStart) {
      console.error('[preview-upgrade] Unable to determine billing period');
      throw new Error('Unable to retrieve subscription billing period');
    }

    // Validate period data
    if (periodEnd <= now) {
      console.error('[preview-upgrade] Billing period has already ended', {
        periodEnd,
        now,
        periodEndDate: new Date(periodEnd * 1000).toISOString(),
        nowDate: new Date(now * 1000).toISOString(),
      });
      throw new Error('Current billing period has ended. Please contact support.');
    }

    const totalPeriod = periodEnd - periodStart;
    const timeRemaining = periodEnd - now;
    const fractionRemaining = Math.max(0, Math.min(1, timeRemaining / totalPeriod));

    console.log('[preview-upgrade] Proration calculation:', {
      totalPeriod,
      timeRemaining,
      fractionRemaining,
      percentRemaining: (fractionRemaining * 100).toFixed(2) + '%',
    });

    // Calculate unused credit (prorated refund for current plan)
    const currentAmount = currentPrice.unit_amount || 0;
    const prorationCredit = Math.round(currentAmount * fractionRemaining);

    // Calculate new charge (prorated charge for new plan)
    const newAmount = newPrice.unit_amount || 0;
    const newChargeAmount = Math.round(newAmount * fractionRemaining);

    // Total due today (can be negative for downgrades)
    const prorationAmount = newChargeAmount - prorationCredit;

    // Determine if upgrade or downgrade
    const isUpgrade = newAmount > currentAmount;

    return NextResponse.json({
      currentPlan: {
        priceId: profile.stripe_price_id,
        amount: currentPrice.unit_amount,
        currency: currentPrice.currency,
        interval: currentPrice.recurring?.interval,
      },
      newPlan: {
        priceId,
        amount: newPrice.unit_amount,
        currency: newPrice.currency,
        interval: newPrice.recurring?.interval,
      },
      proration: {
        credit: prorationCredit,
        newCharge: newChargeAmount,
        totalDue: prorationAmount,
        currency: currentPrice.currency,
        isUpgrade,
        nextBillingDate: new Date(periodEnd * 1000).toISOString(),
        nextBillingAmount: newAmount, // Full amount at next billing
      },
      subscriptionId: subscription.id,
    });
  } catch (error: any) {
    console.error('Preview upgrade error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to preview upgrade' },
      { status: 500 }
    );
  }
}
