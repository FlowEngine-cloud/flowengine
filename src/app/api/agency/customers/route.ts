/**
 * Agency Stripe Customers API
 *
 * GET /api/agency/customers - List customers from agency's Stripe
 * GET /api/agency/customers?search=email - Search customers by email
 *
 * Used by:
 * - Agency: To select which customer to link to a client
 */
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { decryptApiKey } from '@/lib/encryption';
import { resolveEffectiveUserId } from '@/lib/teamAccess';
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

    const effectiveUserId = await resolveEffectiveUserId(supabaseAdmin, user.id);
    const search = req.nextUrl.searchParams.get('search');

    const stripe = await getAgencyStripeClient(effectiveUserId);

    if (!stripe) {
      return NextResponse.json(
        { error: 'Stripe not connected', connected: false },
        { status: 400 }
      );
    }

    try {
      // If search query provided, search by email
      const listParams: Stripe.CustomerListParams = {
        limit: 50,
      };

      if (search) {
        listParams.email = search;
      }

      const customers = await stripe.customers.list(listParams);

      const formattedCustomers = customers.data.map((customer) => ({
        id: customer.id,
        email: customer.email,
        name: customer.name,
        created: customer.created,
      }));

      return NextResponse.json({
        customers: formattedCustomers,
      });
    } catch (stripeError: any) {
      console.error('Failed to list customers:', stripeError.message);
      return NextResponse.json(
        { error: 'Failed to fetch customers from Stripe' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Customers API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
