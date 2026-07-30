import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, extractErrors } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { Errors } from '../components/Errors';

export function SigninPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ message: string }[] | null>(null);
  const { refresh } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors(null);
    try {
      await api.post('/api/users/signin', { email, password });
      await refresh();
      navigate('/');
    } catch (err) {
      setErrors(extractErrors(err));
    }
  };

  return (
    <div className="card" style={{ maxWidth: 420 }}>
      <h1>Sign in</h1>
      <form onSubmit={onSubmit}>
        <label>Email address</label>
        <input value={email} onChange={(e) => setEmail(e.target.value)} />
        <label>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <Errors errors={errors} />
        <div style={{ marginTop: 16 }}>
          <button className="btn">Sign in</button>
        </div>
      </form>
    </div>
  );
}
