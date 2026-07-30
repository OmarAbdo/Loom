import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, extractErrors } from '../api/client';
import { Errors } from '../components/Errors';
import { StatusBadge } from '../components/StatusBadge';
import { PaymentForm } from '../components/PaymentForm';
import type { Order } from '../api/types';

/**
 * Order detail: shows the order, a live countdown to expiry, and — while the
 * order is still payable — the Stripe payment form. Polls the order so the
 * status flips to `complete` (or `cancelled`) as the saga progresses.
 */
export function OrderShowPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<Order | null>(null);
  const [errors, setErrors] = useState<{ message: string }[] | null>(null);
  const [msLeft, setMsLeft] = useState<number>(0);

  const load = async () => {
    try {
      const { data } = await api.get<Order>(`/api/orders/${orderId}`);
      setOrder(data);
    } catch (err) {
      setErrors(extractErrors(err));
    }
  };

  // Initial load + poll every 3s so status changes (payment/expiry) surface.
  useEffect(() => {
    load();
    const poll = setInterval(load, 3000);
    return () => clearInterval(poll);
  }, [orderId]);

  // Countdown to expiresAt, ticking each second.
  useEffect(() => {
    if (!order?.expiresAt) return;
    const tick = () => {
      const ms = new Date(order.expiresAt!).getTime() - Date.now();
      setMsLeft(Math.max(ms, 0));
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [order?.expiresAt]);

  if (errors) return <Errors errors={errors} />;
  if (!order) return <p className="muted">Loading order…</p>;

  const secondsLeft = Math.round(msLeft / 1000);
  const expired = order.status === 'cancelled' || (order.status !== 'complete' && msLeft <= 0);
  const payable = order.status !== 'complete' && order.status !== 'cancelled' && msLeft > 0;

  return (
    <div className="card" style={{ maxWidth: 520 }}>
      <h1>{order.ticket.title}</h1>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 12 }}>
        <StatusBadge status={order.status} />
        <span className="price">${order.ticket.price}</span>
      </div>

      {order.status === 'complete' && (
        <p style={{ color: 'var(--ok)' }}>Payment complete — the ticket is yours. 🎉</p>
      )}
      {expired && order.status !== 'complete' && (
        <p style={{ color: 'var(--danger)' }}>This order has expired.</p>
      )}
      {payable && (
        <>
          <p className="muted">Time left to pay: {secondsLeft}s</p>
          <PaymentForm
            orderId={order.id}
            amount={order.ticket.price}
            onPaid={() => {
              // Give the saga a moment, then refresh.
              setTimeout(load, 1500);
            }}
          />
        </>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="btn btn-secondary" onClick={() => navigate('/orders')}>
          Back to orders
        </button>
      </div>
    </div>
  );
}
