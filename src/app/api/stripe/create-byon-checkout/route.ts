import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { isValidEmail, checkRateLimit } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


/**
 * Dedicated checkout endpoint for Agency-paid BYON (Bring Your Own n8n)
 *
 * Flow:
 * 1. Agency clicks "You Pay" + BYON in invite modal
 * 2. This endpoint creates Stripe checkout with client email in metadata
 * 3. Webhook creates external instance + invite + sends email
 *
 * No invite created before payment - keeps it simple.
 */
export async function POST(req: NextRequest) {
  try {
    const { clientEmail, billingCycle } = await req.json();

    // Validate inputs
    if (!isValidEmail(clientEmail)) {
      return NextResponse.json({ error: 'Invalid client email' }, { status: 400 });
    }
    if (!['monthly', 'annual'].includes(billingCycle)) {
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 });
    }

    // Get authenticated user (validates auth before self-invite check)
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Prevent self-invites
    if (clientEmail.toLowerCase() === user.email?.toLowerCase()) {
      return NextResponse.json({ error: 'You cannot invite yourself' }, { status: 400 });
    }

    // Rate limiting: max 10 BYON checkouts per hour per user
    const rateLimitResult = checkRateLimit(`byon-checkout:${user.id}`, 10, 60 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('tier, full_name, stripe_customer_id')
      .eq('id', user.id)
      .single();

    // Check for existing pending invite to this email from this user
    const { data: existingInvite } = await supabaseAdmin
      .from('client_invites')
      .select('id')
      .eq('email', clientEmail.toLowerCase())
      .eq('invited_by', user.id)
      .eq('status', 'pending')
      .maybeSingle();

    if (existingInvite) {
      return NextResponse.json({ error: 'A pending invitation already exists for this email' }, { status: 400 });
    }

    // Check for existing pending invite from other agencies
    const { data: existingFromOthers } = await supabaseAdmin
      .from('client_invites')
      .select('id')
      .eq('email', clientEmail.toLowerCase())
      .eq('status', 'pending')
      .neq('invited_by', user.id)
      .maybeSingle();

    if (existingFromOthers) {
      return NextResponse.json({ error: 'This email already has a pending invitation from another agency' }, { status: 400 });
    }

    // Get or create Stripe customer
    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email!,
        name: profile?.full_name || user.email!.split('@')[0],
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    // Get portal price ID
    const priceId = billingCycle === 'annual'
      ? process.env.STRIPE_PRICE_PORTAL_ANNUAL
      : process.env.STRIPE_PRICE_PORTAL_MONTHLY;

    if (!priceId) {
      console.error('Missing STRIPE_PRICE_PORTAL env var for', billingCycle);
      return NextResponse.json({ error: 'Portal pricing not configured' }, { status: 500 });
    }

    // Build URLs
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
    const successUrl = `${origin}/thank-you?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${origin}/n8n-account`;

    // Create checkout session with simple metadata
    const session = await getStripe().checkout.sessions.create({
      customer: customerId,
      client_reference_id: user.id,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
      payment_method_collection: 'if_required',
      metadata: {
        flow_type: 'agency_byon',  // Identifies this flow in webhook
        user_id: user.id,
        client_email: clientEmail.toLowerCase(),
        billing_cycle: billingCycle,
        agency_name: profile?.full_name || 'Your service provider',
      },
      subscription_data: {
        metadata: {
          flow_type: 'agency_byon',
          user_id: user.id,
          client_email: clientEmail.toLowerCase(),
          billing_cycle: billingCycle,
          agency_name: profile?.full_name || 'Your service provider',
        },
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('BYON checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout', details: error.message }, { status: 500 });
  }
}
