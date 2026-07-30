import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../api/client';
import type { CurrentUser } from '../api/types';

interface AuthState {
  currentUser: CurrentUser | null;
  loading: boolean;
  /** Re-fetch currentUser (call after signin/signup/signout). */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  currentUser: null,
  loading: true,
  refresh: async () => {},
});

/**
 * Provides the current user to the app. On mount (and on refresh) it calls
 * /api/users/currentuser. This is the SPA equivalent of Grider's SSR
 * getInitialProps currentUser fetch — done in the browser instead, so there is a
 * brief `loading` state on first paint (the tradeoff of dropping SSR).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { data } = await api.get<{ currentUser: CurrentUser | null }>(
        '/api/users/currentuser'
      );
      setCurrentUser(data.currentUser);
    } catch {
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AuthContext.Provider value={{ currentUser, loading, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
