import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';


export async function POST(req: NextRequest) {
  try {
    // Get the Authorization header instead of using cookies
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

    // Get user's Stripe customer ID
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('Profile fetch error:', profileError);
      return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }

    if (!profile?.stripe_customer_id) {
      return NextResponse.json(
        { error: 'No Stripe customer found. Please subscribe first.' },
        { status: 400 }
      );
    }

    // Optional: custom return URL
    const body = await req.json().catch(() => ({}));
    const returnUrl = body.return_url || `${process.env.NEXT_PUBLIC_SITE_URL}/settings`;

    // Create portal session
    const portalSession = await getStripe().billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });

    console.log(' Billing portal session created:', portalSession.id);

    return NextResponse.json({
      url: portalSession.url,
    });
  } catch (error: any) {
    console.error('Portal session creation error:', error);
    return NextResponse.json(
      {
        error: 'Failed to create billing portal session',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
