/**
 * Agency Stripe Key Management
 *
 * POST /api/agency/stripe-key - Save Stripe API key
 * DELETE /api/agency/stripe-key - Remove Stripe API key
 *
 * The API key is encrypted before storage.
 */
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption';
import { checkRateLimit } from '@/lib/validation';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';


// POST: Save Stripe API key
export async function POST(req: NextRequest) {
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

    // Rate limiting: 5 Stripe key changes per minute per user
    const rateLimitResult = checkRateLimit(`stripe-key:${user.id}`, 5, 60 * 1000);
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }

    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const { apiKey } = await req.json();

    // Validate the API key format
    if (!apiKey || typeof apiKey !== 'string') {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      );
    }

    if (!apiKey.startsWith('sk_live_') && !apiKey.startsWith('sk_test_')) {
      return NextResponse.json(
        { error: 'Invalid Stripe API key format. Must start with sk_live_ or sk_test_' },
        { status: 400 }
      );
    }

    // Validate the key by making a test request to Stripe
    try {
      const stripeResponse = await fetch('https://api.stripe.com/v1/customers?limit=1', {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!stripeResponse.ok) {
        const errorData = await stripeResponse.json().catch(() => ({}));
        return NextResponse.json(
          { error: errorData.error?.message || 'Invalid Stripe API key' },
          { status: 400 }
        );
      }
    } catch (stripeError: any) {
      console.error('Stripe validation failed:', stripeError.message);
      return NextResponse.json(
        { error: 'Failed to validate Stripe API key' },
        { status: 400 }
      );
    }

    // Encrypt the API key
    const encryptedKey = encrypt(apiKey);

    // Save the key
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        agency_stripe_key_encrypted: encryptedKey,
        agency_stripe_key_set: true,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to save Stripe key:', updateError);
      return NextResponse.json(
        { error: 'Failed to save Stripe API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Stripe API key saved successfully',
    });
  } catch (error) {
    console.error('Save Stripe key error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Remove Stripe API key
export async function DELETE(req: NextRequest) {
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

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        agency_stripe_key_encrypted: null,
        agency_stripe_key_set: false,
      })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to remove Stripe key:', updateError);
      return NextResponse.json(
        { error: 'Failed to remove Stripe API key' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Stripe API key removed',
    });
  } catch (error) {
    console.error('Remove Stripe key error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
