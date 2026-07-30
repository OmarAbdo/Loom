import { loadStripe } from '@stripe/stripe-js';

/**
 * Stripe.js loader.
 *
 * The PUBLISHABLE key (pk_test_...) is a build-time env var. It is safe to ship
 * in the client — it only lets the browser tokenize a card; charges require the
 * SECRET key, which lives only in the payments service (the stripe-secret k8s
 * Secret). Set VITE_STRIPE_PUBLISHABLE_KEY at build time; the placeholder below
 * lets the app build/run, but a real test key is needed to actually tokenize.
 */
const PUBLISHABLE_KEY =
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder';

export const stripePromise = loadStripe(PUBLISHABLE_KEY);
