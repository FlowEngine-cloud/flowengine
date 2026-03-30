import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { isValidUUID, checkRateLimit } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


/**
 * Dedicated checkout endpoint for Client-paid BYON (Bring Your Own n8n)
 *
 * Flow:
 * 1. Agency invites client with storageSize=0 (BYON)
 * 2. Client accepts invite, clicks "Continue to Payment"
 * 3. This endpoint creates Stripe checkout with invite details in metadata
 * 4. Webhook creates external instance + marks invite accepted
 *
 * Clean, isolated - no conditionals shared with other flows.
 */
export async function POST(req: NextRequest) {
  try {
    const { inviteId, billingCycle } = await req.json();

    // Validate inputs
    if (!inviteId || !isValidUUID(inviteId)) {
      return NextResponse.json({ error: 'Invalid invite ID' }, { status: 400 });
    }
    if (!['monthly', 'annual'].includes(billingCycle)) {
      return NextResponse.json({ error: 'Invalid billing cycle' }, { status: 400 });
    }

    // Get authenticated user (the client accepting the invite)
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authorization.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Rate limiting: max 10 checkout attempts per hour per user
    const rateLimitResult = checkRateLimit(`client-byon-checkout:${user.id}`, 10, 60 * 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many checkout attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Fetch invite and verify it's valid (including expiration check)
    const { data: invite, error: inviteError } = await supabaseAdmin
      .from('client_invites')
      .select('id, token, email, invited_by, storage_size_gb, billing_cycle, is_external, status, allow_full_access, expires_at')
      .eq('id', inviteId)
      .eq('status', 'pending')
      .single();

    if (inviteError || !invite) {
      return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 400 });
    }

    // Check if invite has expired
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return NextResponse.json({ error: 'This invitation has expired' }, { status: 400 });
    }

    // Verify this is a BYON invite
    if (!invite.is_external && invite.storage_size_gb !== 0) {
      return NextResponse.json({ error: 'This invite is not for BYON' }, { status: 400 });
    }

    // Verify email matches (case-insensitive)
    if (invite.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({
        error: 'Email mismatch',
        message: `This invitation was sent to ${invite.email}. Please log in with that email address.`
      }, { status: 403 });
    }

    // Get inviter's name for instance naming
    const { data: inviterProfile } = await supabaseAdmin
      .from('profiles')
      .select('full_name')
      .eq('id', invite.invited_by)
      .single();

    const inviterName = inviterProfile?.full_name || 'Agency';

    // Get or create Stripe customer for client
    let { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('id', user.id)
      .single();

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
    const cancelUrl = `${origin}/invite/accept?token=${invite.token}`;

    // Create checkout session with clean metadata
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
        flow_type: 'client_byon',  // Identifies this flow in webhook
        user_id: user.id,
        invite_id: inviteId,
        invited_by: invite.invited_by,
        billing_cycle: billingCycle,
        inviter_name: inviterName,
        allow_full_access: String(invite.allow_full_access ?? false),
      },
      subscription_data: {
        metadata: {
          flow_type: 'client_byon',
          user_id: user.id,
          invite_id: inviteId,
          invited_by: invite.invited_by,
          billing_cycle: billingCycle,
          allow_full_access: String(invite.allow_full_access ?? false),
        },
      },
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error('Client BYON checkout error:', error);
    return NextResponse.json({ error: 'Failed to create checkout', details: error.message }, { status: 500 });
  }
}
