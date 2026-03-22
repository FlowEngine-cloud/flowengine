import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


/**
 * POST /api/stripe/cancel-subscription
 * Cancels a Stripe subscription (used for WhatsApp instances).
 * The Stripe webhook will handle cleanup (soft-delete, Evolution API session deletion).
 *
 * Body: { subscriptionId: string }
 */
export async function POST(req: NextRequest) {
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { subscriptionId } = await req.json();
    if (!subscriptionId) {
      return NextResponse.json({ error: 'subscriptionId is required' }, { status: 400 });
    }

    // Verify the user owns this subscription by checking whatsapp_instances
    const { data: waInstance, error: findErr } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('id, user_id')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle();

    if (findErr || !waInstance) {
      return NextResponse.json({ error: 'Subscription not found or not owned by you' }, { status: 404 });
    }

    // Cancel the subscription at period end (gives user remaining time)
    await getStripe().subscriptions.cancel(subscriptionId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Cancel subscription error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
