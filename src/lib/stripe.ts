import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/** Get a lazily-initialized Stripe client. Throws at call time if key is missing. */
export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not configured. Set it in your .env.local to enable Stripe features.');
    }
    _stripe = new Stripe(key);
  }
  return _stripe;
}
