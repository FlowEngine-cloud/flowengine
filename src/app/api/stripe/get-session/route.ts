import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabaseAdmin';



export async function GET(req: NextRequest) {
  try {
    // Authenticate user
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

    // Get session ID from query params
    const sessionId = req.nextUrl.searchParams.get('session_id');
    if (!sessionId) {
      return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
    }

    // Retrieve session from Stripe
    const session = await getStripe().checkout.sessions.retrieve(sessionId, {
      expand: ['line_items', 'subscription'],
    });

    // Verify session belongs to this user
    if (session.client_reference_id !== user.id) {
      return NextResponse.json({ error: 'Session does not belong to user' }, { status: 403 });
    }

    return NextResponse.json({
      id: session.id,
      metadata: session.metadata,
      subscription: session.subscription,
      customer: session.customer,
      payment_status: session.payment_status,
      status: session.status,
      // Add transaction details for conversion tracking
      amount_total: session.amount_total ? session.amount_total / 100 : 0, // Convert cents to dollars
      currency: session.currency || 'usd',
    });

  } catch (error: any) {
    console.error('Get session error:', error);
    return NextResponse.json({
      error: 'Failed to retrieve session',
      details: error.message,
    }, { status: 500 });
  }
}
