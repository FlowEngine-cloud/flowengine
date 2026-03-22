import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import type Stripe from 'stripe';


export async function POST(req: NextRequest) {
  try {
    const { coupon } = await req.json();

    if (!coupon || !coupon.trim()) {
      return NextResponse.json(
        { valid: false, message: 'Coupon code is required' },
        { status: 400 }
      );
    }

    // Try to interpret as a Promotion Code ID (promo_...) first
    let stripeCoupon: Stripe.Coupon | null = null;
    let source: 'promotion_code' | 'coupon' | 'code_lookup' | null = null;
    const raw = coupon.trim();

    try {
      if (raw.startsWith('promo_')) {
        const promo = await getStripe().promotionCodes.retrieve(raw);
        if (promo.active && promo.coupon && promo.coupon.valid) {
          stripeCoupon = promo.coupon as Stripe.Coupon;
          source = 'promotion_code';
        }
      }
    } catch {}

    // If not promo id, try direct coupon id/code
    if (!stripeCoupon) {
      try {
        const c = await getStripe().coupons.retrieve(raw.toUpperCase());
        if (c.valid) {
          stripeCoupon = c;
          source = 'coupon';
        }
      } catch {}
    }

    // If still not found, try finding a promotion code by its code string
    if (!stripeCoupon) {
      try {
        const list = await getStripe().promotionCodes.list({ code: raw, limit: 1 });
        const promo = list.data[0];
        if (promo && promo.active && promo.coupon && promo.coupon.valid) {
          stripeCoupon = promo.coupon as Stripe.Coupon;
          source = 'code_lookup';
        }
      } catch {}
    }

    if (!stripeCoupon || !stripeCoupon.valid) {
      return NextResponse.json(
        { valid: false, message: 'This coupon or promotion code is invalid or inactive' },
        { status: 400 }
      );
    }

    const percent = stripeCoupon.percent_off;
    const amountOff = stripeCoupon.amount_off;
    const message = percent
      ? `${percent}% off`
      : amountOff
        ? `$${(amountOff / 100).toFixed(2)} off`
        : 'Valid discount';

    // Return coupon details
    return NextResponse.json({
      valid: true,
      coupon: stripeCoupon,
      source,
      discount: percent ?? amountOff ?? null,
      discountType: percent ? 'percent' : amountOff ? 'amount' : null,
      message,
    });
  } catch (error: any) {
    console.error('Coupon validation error:', error);

    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json({ valid: false, message: 'Invalid coupon code' }, { status: 400 });
    }

    return NextResponse.json({ valid: false, message: 'Error validating coupon' }, { status: 500 });
  }
}
