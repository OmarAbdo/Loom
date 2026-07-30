import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';

/** Top nav: brand + auth-aware links. */
export function Header() {
  const { currentUser, refresh } = useAuth();
  const navigate = useNavigate();

  const signOut = async () => {
    await api.post('/api/users/signout', {});
    await refresh();
    navigate('/');
  };

  return (
    <nav className="nav">
      <Link to="/" className="brand">GitTix</Link>
      <div className="links">
        {currentUser ? (
          <>
            <Link to="/tickets/new">Sell a ticket</Link>
            <Link to="/orders">My orders</Link>
            <span className="muted">{currentUser.email}</span>
            <button className="btn btn-secondary" onClick={signOut}>Sign out</button>
          </>
        ) : (
          <>
            <Link to="/auth/signup">Sign up</Link>
            <Link to="/auth/signin">Sign in</Link>
          </>
        )}
      </div>
    </nav>
  );
}
