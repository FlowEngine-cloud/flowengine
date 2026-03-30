import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';
import { isValidUUID } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getEffectiveOwnerId, canManageBilling } from '@/lib/teamUtils';


export async function POST(req: NextRequest) {
  try {
    // Note: BYON flows use dedicated endpoints (/api/stripe/create-byon-checkout, /api/stripe/create-client-byon-checkout)
    const { priceId, planType, customAmount, tokenAmount, instanceName, storageLimit, billingCycle, clientInviteId, targetUserId, cancelUrl: customCancelUrl, includeWhatsApp } = await req.json();

    console.log('Checkout request received:', {
      planType,
      instanceName,
      storageLimit,
      storageLimitType: typeof storageLimit,
      billingCycle,
      billingCycleType: typeof billingCycle,
    });

    // Validate clientInviteId if provided
    if (clientInviteId && !isValidUUID(clientInviteId)) {
      return NextResponse.json({ error: 'Invalid client invite ID format' }, { status: 400 });
    }

    // Validate pay-per-instance specific fields and determine price ID server-side
    let resolvedPriceId = priceId;
    if (planType === 'pay_per_instance') {
      if (!instanceName?.trim()) {
        return NextResponse.json({ error: 'Instance name is required for pay-per-instance' }, { status: 400 });
      }
      // 0 = Bring Your Own n8n (portal only), 10/30/50 = hosted instances
      if (![0, 10, 30, 50].includes(storageLimit)) {
        return NextResponse.json(
          {
            error: 'Invalid storage limit',
            received: storageLimit,
            type: typeof storageLimit,
          },
          { status: 400 }
        );
      }
      if (!['monthly', 'annual'].includes(billingCycle)) {
        return NextResponse.json(
          {
            error: 'Billing cycle must be monthly or annual',
            received: billingCycle,
            type: typeof billingCycle,
          },
          { status: 400 }
        );
      }

      // Determine price ID server-side from environment variables
      const priceIdMap: Record<string, string | undefined> = {
        '0-monthly': process.env.STRIPE_PRICE_PORTAL_MONTHLY,
        '0-annual': process.env.STRIPE_PRICE_PORTAL_ANNUAL,
        '10-monthly': process.env.NEXT_PUBLIC_STRIPE_10GB_MONTHLY_PRICE_ID,
        '10-annual': process.env.NEXT_PUBLIC_STRIPE_10GB_ANNUAL_PRICE_ID,
        '30-monthly': process.env.NEXT_PUBLIC_STRIPE_30GB_MONTHLY_PRICE_ID,
        '30-annual': process.env.NEXT_PUBLIC_STRIPE_30GB_ANNUAL_PRICE_ID,
        '50-monthly': process.env.NEXT_PUBLIC_STRIPE_50GB_MONTHLY_PRICE_ID,
        '50-annual': process.env.NEXT_PUBLIC_STRIPE_50GB_ANNUAL_PRICE_ID,
      };

      const priceKey = `${storageLimit}-${billingCycle}`;
      resolvedPriceId = priceIdMap[priceKey];

      console.log('Pay-per-instance checkout:', {
        storageLimit,
        billingCycle,
        priceKey,
        resolvedPriceId,
        availableKeys: Object.keys(priceIdMap),
        priceIdMap,
      });

      if (!resolvedPriceId) {
        console.error('Failed to resolve price ID:', { priceKey, priceIdMap });
        return NextResponse.json(
          {
            error: 'Invalid storage/billing configuration',
            details: `Could not find price ID for ${priceKey}. Available: ${Object.keys(priceIdMap).join(', ')}`,
          },
          { status: 400 }
        );
      }
    } else if (!priceId && planType !== 'whatsapp') {
      return NextResponse.json({ error: 'Price ID is required' }, { status: 400 });
    }

    // Get authenticated user from request headers
    const authorization = req.headers.get('authorization');
    if (!authorization) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const token = authorization.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const ctx = await getEffectiveOwnerId(supabaseAdmin, user.id);
    if (ctx.isTeamMember && !canManageBilling(ctx.role)) {
      return NextResponse.json({ error: 'Only team owners and admins can manage billing' }, { status: 403 });
    }
    const effectiveUserId = ctx.ownerId;

    // Get or create user profile
    let { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('id', effectiveUserId)
      .single();

    if (profileError && profileError.code === 'PGRST116') {
      const { data: newProfile, error: createError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: effectiveUserId,
          full_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'User',
        })
        .select('stripe_customer_id, full_name')
        .single();

      if (createError) {
        console.error('Failed to create profile:', createError);
        return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
      }

      profile = newProfile;
    } else if (profileError) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    // Create or retrieve Stripe customer
    let customerId = profile?.stripe_customer_id;

    if (!customerId) {
      const customer = await getStripe().customers.create({
        email: user.email!,
        name: profile?.full_name || user.user_metadata?.full_name || user.email!.split('@')[0],
        metadata: {
          supabase_user_id: effectiveUserId,
        },
      });

      customerId = customer.id;

      // Update profile with customer ID
      await supabaseAdmin.from('profiles').update({ stripe_customer_id: customerId }).eq('id', effectiveUserId);
    }

    // Determine the base URL from the request origin (supports localhost and production)
    const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL;
    const baseUrl = origin || '';

    // All successful payments redirect to thank-you page for conversion tracking
    const successUrl = `${baseUrl}/thank-you?session_id={CHECKOUT_SESSION_ID}`;

    // Prepare session data based on plan type
    // Note: payment_method_collection is only valid for 'subscription' mode, not 'payment' mode
    const isPaymentMode = planType === 'topup';
    let sessionData: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      client_reference_id: effectiveUserId,
      success_url: successUrl,
      cancel_url: customCancelUrl ? `${baseUrl}${customCancelUrl}` : `${baseUrl}/#pricing`,
      allow_promotion_codes: true,
      ...(isPaymentMode ? {} : { payment_method_collection: 'if_required' as const }),
      metadata: {
        supabase_user_id: effectiveUserId,
        user_id: effectiveUserId,
        plan_type: planType || 'subscription',
      },
    };

    if (planType === 'whatsapp') {
      // WhatsApp API subscription mode
      const whatsappBillingCycle = billingCycle || 'monthly';
      if (!['monthly', 'annual'].includes(whatsappBillingCycle)) {
        return NextResponse.json({ error: 'Billing cycle must be monthly or annual' }, { status: 400 });
      }

      const whatsappPriceId = whatsappBillingCycle === 'annual'
        ? process.env.STRIPE_PRICE_WHATSAPP_ANNUAL
        : process.env.STRIPE_PRICE_WHATSAPP_MONTHLY;

      if (!whatsappPriceId) {
        return NextResponse.json({ error: 'WhatsApp pricing not configured' }, { status: 500 });
      }

      resolvedPriceId = whatsappPriceId;
      sessionData.mode = 'subscription';
      sessionData.line_items = [{ price: resolvedPriceId, quantity: 1 }];

      sessionData.metadata!.plan_type = 'whatsapp';
      sessionData.metadata!.billing_cycle = whatsappBillingCycle;
      if (instanceName) {
        sessionData.metadata!.display_name = instanceName; // User-provided display name
      }

      // If this is a client invite (client-paid WhatsApp flow), add invite details
      if (clientInviteId) {
        const { data: invite, error: inviteError } = await supabaseAdmin
          .from('client_invites')
          .select('invited_by, allow_full_access')
          .eq('id', clientInviteId)
          .eq('status', 'pending')
          .maybeSingle();

        if (inviteError || !invite) {
          return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 400 });
        }

        sessionData.metadata!.client_invite_id = clientInviteId;
        sessionData.metadata!.client_invited_by = invite.invited_by;
      }

      sessionData.subscription_data = {
        metadata: {
          supabase_user_id: effectiveUserId,
          user_id: effectiveUserId,
          plan_type: 'whatsapp',
          billing_cycle: whatsappBillingCycle,
          ...(clientInviteId && { client_invite_id: clientInviteId }),
        },
      };
    } else if (planType === 'pay_per_instance') {
      // Pay-per-instance subscription mode
      sessionData.mode = 'subscription';
      sessionData.line_items = [
        {
          price: resolvedPriceId,
          quantity: 1,
        },
      ];

      // Add instance metadata to session
      sessionData.metadata!.plan_type = 'pay_per_instance';
      sessionData.metadata!.instance_name = instanceName;
      sessionData.metadata!.storage_limit = storageLimit.toString();
      sessionData.metadata!.price_id = resolvedPriceId;
      sessionData.metadata!.billing_cycle = billingCycle; // ✅ Add billing cycle to metadata for $0 checkouts
      sessionData.metadata!.is_external = storageLimit === 0 ? 'true' : 'false'; // BYON/portal-only flag
      if (includeWhatsApp) {
        sessionData.metadata!.include_whatsapp = 'true';
      }

      // If this is a client invite (client-paid flow), add invite details to metadata
      if (clientInviteId) {
        // Fetch invite details NOW to store in metadata
        // This ensures webhook has all data even if invite is modified/deleted later
        const { data: invite, error: inviteError } = await supabaseAdmin
          .from('client_invites')
          .select('invited_by, allow_full_access')
          .eq('id', clientInviteId)
          .eq('status', 'pending')
          .maybeSingle();

        if (inviteError || !invite) {
          console.error('[checkout] Failed to fetch invite for metadata:', inviteError || 'Invite not found');
          return NextResponse.json({ error: 'Invitation not found or already used' }, { status: 400 });
        }

        console.log('[checkout] Storing invite details in metadata:', {
          clientInviteId,
          invited_by: invite.invited_by,
          allow_full_access: invite.allow_full_access,
        });

        sessionData.metadata!.client_invite_id = clientInviteId;
        sessionData.metadata!.client_invited_by = invite.invited_by;
        sessionData.metadata!.client_allow_full_access = String(invite.allow_full_access);
        // Client invites also go to thank-you page (successUrl already set above)
      }

      // Build subscription metadata - copy invite details from session metadata if present
      const subscriptionMetadata: Record<string, string> = {
        supabase_user_id: effectiveUserId,
        user_id: effectiveUserId, // Also add user_id for compatibility
        instance_name: instanceName,
        storage_limit: storageLimit.toString(),
        plan_type: 'pay_per_instance',
        is_external: storageLimit === 0 ? 'true' : 'false', // BYON/portal-only flag
      };

      // Copy invite fields from session metadata if they were set
      if (sessionData.metadata!.client_invite_id) {
        subscriptionMetadata.client_invite_id = sessionData.metadata!.client_invite_id as string;
        subscriptionMetadata.client_invited_by = sessionData.metadata!.client_invited_by as string;
        subscriptionMetadata.client_allow_full_access = sessionData.metadata!.client_allow_full_access as string;
      }

      sessionData.subscription_data = {
        metadata: subscriptionMetadata,
      };
    } else if (planType === 'topup' || !planType) {
      // One-time payment mode (top-up) - use automatic payment methods from Dashboard
      sessionData.mode = 'payment';
      // Remove payment_method_types to allow all Dashboard-enabled methods
      // This enables: card, cashapp, amazon_pay, alipay, klarna, us_bank_account, etc.
      sessionData.metadata!.token_amount = tokenAmount?.toString() || '100';
      sessionData.metadata!.custom_amount = customAmount?.toString() || '1';

      // If topping up for a client (targetUserId), add to metadata (webhook validates)
      if (targetUserId && isValidUUID(targetUserId)) {
        sessionData.metadata!.target_user_id = targetUserId;
        console.log('[checkout] Top-up for client:', { targetUserId, purchaser: user.id });
      }

      if (customAmount && customAmount !== 1) {
        sessionData.line_items = [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: `Token Top-up - ${tokenAmount} tokens`,
                description: `Add ${tokenAmount} tokens to your account`,
              },
              unit_amount: Math.round(customAmount * 100), // Convert to cents
            },
            quantity: 1,
          },
        ];
      } else {
        sessionData.line_items = [
          {
            price: priceId,
            quantity: 1,
          },
        ];
      }
    } else {
      return NextResponse.json({ error: `Unsupported plan type: ${planType}` }, { status: 400 });
    }

    // Create checkout session with Stripe
    const session = await getStripe().checkout.sessions.create(sessionData);

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    });
  } catch (error: any) {
    console.error('Checkout creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create checkout session',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
