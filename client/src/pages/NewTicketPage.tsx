import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, extractErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Errors } from '../components/Errors';

/** Create a ticket to sell. Requires sign-in. */
export function NewTicketPage() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState('');
  const [errors, setErrors] = useState<{ message: string }[] | null>(null);

  if (!currentUser) {
    return <p className="muted">Please sign in to sell a ticket.</p>;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    try {
      await api.post('/api/tickets', { title, price: parseFloat(price) });
      navigate('/');
    } catch (err) {
      setErrors(extractErrors(err));
    }
  };

  // Round the price to 2 decimals on blur (matches Grider's UX nicety).
  const onBlurPrice = () => {
    const v = parseFloat(price);
    if (!isNaN(v)) setPrice(v.toFixed(2));
  };

  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <h1>Sell a ticket</h1>
      <form onSubmit={onSubmit}>
        <label>Title</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>Price</label>
        <input value={price} onChange={(e) => setPrice(e.target.value)} onBlur={onBlurPrice} />
        <Errors errors={errors} />
        <div style={{ marginTop: 16 }}>
          <button className="btn">List ticket</button>
        </div>
      </form>
    </div>
  );
}
