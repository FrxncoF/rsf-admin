import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, ROLES } from '@/features/auth/AuthContext';
import { AppConfigProvider } from '@/features/app-config/AppConfigContext';
import { GuestOnly, RequireAuth, RequireRole } from '@/features/auth/RouteGuards';
import { FullScreenLoader } from '@/components/ui/Feedback';
import AppLayout from '@/components/layout/AppLayout';
import LoginPage from '@/features/auth/LoginPage';
import ResidentsPage from '@/features/residents/ResidentsPage';
import ResidentDetailPage from '@/features/residents/detail/ResidentDetailPage';
import { ForbiddenPage, NotFoundPage } from '@/pages/StatusPages';

const UsersPage = lazy(() => import('@/features/users/UsersPage'));
const SettingsPage = lazy(() => import('@/features/settings/SettingsPage'));
const GuardiansPage = lazy(() => import('@/features/guardians/GuardiansPage'));
const DailyLogFormPage = lazy(() => import('@/features/daily-log/DailyLogFormPage'));
const DailyReportsPage = lazy(() => import('@/features/daily-reports/DailyReportsPage'));
const SupportPage = lazy(() => import('@/features/support/SupportPage'));
const MedicationRoundsPage = lazy(() => import('@/features/medications/MedicationRoundsPage'));
const PillboxPage = lazy(() => import('@/features/medications/PillboxPage'));
const BookingsPage = lazy(() => import('@/features/bookings/BookingsPage'));
const PublicBookingPage = lazy(() => import('@/features/bookings/public/PublicBookingPage'));
const CancelBookingPage = lazy(() => import('@/features/bookings/public/CancelBookingPage'));
const PrivacyPage = lazy(() => import('@/features/bookings/public/PrivacyPage'));
const ForgotPasswordPage = lazy(() => import('@/features/auth/PasswordResetPages').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/features/auth/PasswordResetPages').then((m) => ({ default: m.ResetPasswordPage })));

export default function App() {
  return (
    <BrowserRouter>
      <AppConfigProvider>
      <AuthProvider>
        <Suspense fallback={<FullScreenLoader />}>
          <Routes>
            {/* Públicas (familias, sin login): reservas de visitas */}
            <Route path="reservar" element={<PublicBookingPage />} />
            <Route path="reservar/cancelar" element={<CancelBookingPage />} />
            <Route path="reservar/privacidad" element={<PrivacyPage />} />
            {/* Recuperar contraseña (sin sesión) */}
            <Route path="olvide-contrasena" element={<ForgotPasswordPage />} />
            <Route path="restablecer-contrasena" element={<ResetPasswordPage />} />

            <Route element={<GuestOnly />}>
              <Route path="/login" element={<LoginPage />} />
            </Route>

            <Route element={<RequireAuth />}>
              {/* La hoja para imprimir ahora es un PDF (desde Pastillero) */}
              <Route path="pastillero/imprimir" element={<Navigate to="/pastillero" replace />} />

              <Route element={<AppLayout />}>
                <Route index element={<Navigate to="/residentes" replace />} />
                <Route path="residentes" element={<ResidentsPage />} />
                <Route path="residentes/:id" element={<ResidentDetailPage />} />
                {/* Ficha del turno en curso, o una ficha específica (editable mientras dure su turno) */}
                <Route path="residentes/:id/ficha" element={<DailyLogFormPage />} />
                <Route path="residentes/:id/ficha/nueva" element={<Navigate to=".." relative="path" replace />} />
                <Route path="residentes/:id/ficha/:logId" element={<DailyLogFormPage />} />
                <Route path="medicacion" element={<MedicationRoundsPage />} />
                <Route path="pastillero" element={<PillboxPage />} />
                {/* Visitas = agenda por bloques (reservas de familias + agendadas por el equipo) */}
                <Route path="visitas" element={<BookingsPage />} />
                <Route path="reservas" element={<Navigate to="/visitas" replace />} />
                <Route path="configuracion" element={<SettingsPage />} />

                <Route element={<RequireRole roles={[ROLES.ADMIN]} />}>
                  <Route path="usuarios" element={<UsersPage />} />
                  <Route path="apoderados" element={<GuardiansPage />} />
                </Route>

                <Route element={<RequireRole roles={[ROLES.ADMIN, ROLES.ENCARGADA]} />}>
                  <Route path="reportes" element={<DailyReportsPage />} />
                </Route>

                <Route element={<RequireRole roles={[ROLES.SOPORTE]} />}>
                  <Route path="soporte" element={<SupportPage />} />
                </Route>

                <Route path="403" element={<ForbiddenPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </AuthProvider>
      </AppConfigProvider>
    </BrowserRouter>
  );
}
