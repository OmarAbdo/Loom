import { useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { api, extractErrors } from '../api/client';
import { Errors } from './Errors';
import { stripePromise } from '../stripe';

interface Props {
  orderId: string;
  amount: number;
  onPaid: () => void;
}

/**
 * Card form. Uses Stripe.js to tokenize the card in the browser (the secret key
 * never touches the client), then POSTs { orderId, token } to /api/payments,
 * which performs the charge server-side and publishes payment.created.
 */
function InnerForm({ orderId, amount, onPaid }: Props) {
  const stripe = useStripe();
  const elements = useElements();
  const [errors, setErrors] = useState<{ message: string }[] | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setErrors(null);
    setBusy(true);
    try {
      const card = elements.getElement(CardElement);
      if (!card) throw new Error('Card element not ready');

      // Create a single-use token from the card details.
      const { token, error } = await stripe.createToken(card);
      if (error || !token) {
        setErrors([{ message: error?.message ?? 'Card was declined' }]);
        return;
      }

      await api.post('/api/payments', { orderId, token: token.id });
      onPaid();
    } catch (err) {
      setErrors(extractErrors(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit}>
      <label>Card details (Stripe test card: 4242 4242 4242 4242)</label>
      <div
        style={{
          padding: '12px',
          border: '1px solid var(--border)',
          borderRadius: 8,
          background: '#10131a',
        }}
      >
        <CardElement options={{ style: { base: { color: '#e6e8ec', fontSize: '16px' } } }} />
      </div>
      <Errors errors={errors} />
      <div style={{ marginTop: 16 }}>
        <button className="btn" disabled={!stripe || busy}>
          {busy ? 'Processing…' : `Pay $${amount}`}
        </button>
      </div>
    </form>
  );
}

/** Wraps the card form in Stripe's <Elements> provider. */
export function PaymentForm(props: Props) {
  return (
    <Elements stripe={stripePromise}>
      <InnerForm {...props} />
    </Elements>
  );
}
