import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { FullScreenLoader } from '@/components/ui/Feedback';
import { useAuth } from './AuthContext';

/** Exige sesión iniciada; si no, redirige a /login recordando la ruta de origen. */
export function RequireAuth() {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

/** Exige uno de los roles indicados (usar dentro de RequireAuth). */
export function RequireRole({ roles }) {
  const { user } = useAuth();
  if (!roles.includes(user?.role)) return <Navigate to="/403" replace />;
  return <Outlet />;
}

/** Para /login: si ya hay sesión, ir al inicio. */
export function GuestOnly() {
  const { user, status } = useAuth();
  if (status === 'loading') return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return <Outlet />;
}
