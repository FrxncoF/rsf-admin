import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, UNAUTHORIZED_EVENT } from '@/lib/api';

export const ROLES = Object.freeze({ ADMIN: 'ADMIN', CUIDADORA: 'CUIDADORA' });

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready

  useEffect(() => {
    api
      .get('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setStatus('ready'));

    const onUnauthorized = () => setUser(null);
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  const login = useCallback(async (email, password) => {
    const { user } = await api.post('/auth/login', { email, password });
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      setUser(null);
    }
  }, []);

  const updateProfile = useCallback(async (changes) => {
    const { user } = await api.patch('/auth/me', changes);
    setUser(user);
    return user;
  }, []);

  const value = useMemo(
    () => ({ user, status, login, logout, updateProfile, isAdmin: user?.role === ROLES.ADMIN }),
    [user, status, login, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
