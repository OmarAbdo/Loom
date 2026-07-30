import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, extractErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Errors } from '../components/Errors';
import { StatusBadge } from '../components/StatusBadge';
import type { Order } from '../api/types';

/** Lists the current user's orders. */
export function OrdersPage() {
  const { currentUser } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [errors, setErrors] = useState<{ message: string }[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    api
      .get<Order[]>('/api/orders')
      .then(({ data }) => setOrders(data))
      .catch((err) => setErrors(extractErrors(err)))
      .finally(() => setLoading(false));
  }, [currentUser]);

  if (!currentUser) return <p className="muted">Please sign in to view your orders.</p>;
  if (loading) return <p className="muted">Loading orders…</p>;

  return (
    <>
      <h1>My orders</h1>
      <Errors errors={errors} />
      {orders.length === 0 && <p className="muted">You have no orders yet.</p>}
      {orders.map((o) => (
        <div className="ticket-row" key={o.id}>
          <div>
            <strong>{o.ticket.title}</strong>
            <div className="muted">${o.ticket.price}</div>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <StatusBadge status={o.status} />
            <Link to={`/orders/${o.id}`} className="btn btn-secondary">View</Link>
          </div>
        </div>
      ))}
    </>
  );
}
