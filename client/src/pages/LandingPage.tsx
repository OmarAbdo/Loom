import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, extractErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Errors } from '../components/Errors';
import type { Ticket } from '../api/types';

/**
 * Landing / browse page: lists all tickets. A signed-in user can order any
 * ticket that is not their own and not already reserved.
 */
export function LandingPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [errors, setErrors] = useState<{ message: string }[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Ticket[]>('/api/tickets')
      .then(({ data }) => setTickets(data))
      .catch((err) => setErrors(extractErrors(err)))
      .finally(() => setLoading(false));
  }, []);

  const order = async (ticket: Ticket) => {
    setErrors(null);
    try {
      const { data } = await api.post('/api/orders', { ticketId: ticket.id });
      navigate(`/orders/${data.id}`);
    } catch (err) {
      setErrors(extractErrors(err));
    }
  };

  if (loading) return <p className="muted">Loading tickets…</p>;

  return (
    <>
      <h1>Tickets</h1>
      <Errors errors={errors} />
      {tickets.length === 0 && <p className="muted">No tickets yet. Be the first to sell one.</p>}
      {tickets.map((t) => {
        const mine = currentUser?.id === t.userId;
        const reserved = !!t.orderId;
        return (
          <div className="ticket-row" key={t.id}>
            <div>
              <strong>{t.title}</strong>{' '}
              {reserved && <span className="badge badge-cancelled">reserved</span>}
              <div className="muted">by {mine ? 'you' : t.userId.slice(0, 8)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <span className="price">${t.price}</span>
              {currentUser && !mine && !reserved && (
                <button className="btn" onClick={() => order(t)}>Purchase</button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
