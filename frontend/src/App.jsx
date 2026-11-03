import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, ROLES } from '@/features/auth/AuthContext';
import { GuestOnly, RequireAuth, RequireRole } from '@/features/auth/RouteGuards';
import { FullScreenLoader } from '@/components/ui/Feedback';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/features/auth/LoginPage';
import ResidentsPage from '@/features/residents/ResidentsPage';
import ResidentDetailPage from '@/features/residents/detail/ResidentDetailPage';
import { ForbiddenPage, NotFoundPage } from '@/pages/StatusPages';

const UsersPage = lazy(() => import('@/features/users/UsersPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<FullScreenLoader />}>
          <Routes>
            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<RequireAuth />}>
              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/residentes" replace />} />
                <Route path="residentes" element={<ResidentsPage />} />
                <Route path="residentes/:id" element={<ResidentDetailPage />} />
                <Route path="configuracion" element={<SettingsPage />} />

                <Route element={<RequireRole roles={[ROLES.ADMIN]} />}>
                  <Route path="usuarios" element={<UsersPage />} />
                </Route>

                <Route path="403" element={<ForbiddenPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}
