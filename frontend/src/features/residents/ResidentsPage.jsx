import { useAuth } from '@/features/auth/AuthContext';
import AdminResidentsView from './admin/AdminResidentsView';
import CaregiverResidentsView from './caregiver/CaregiverResidentsView';

/** Misma ruta, distinta experiencia según rol: gestión (ADMIN) o selección rápida (CUIDADORA). */
export default function ResidentsPage() {
  const { isAdmin } = useAuth();
  return isAdmin ? <AdminResidentsView /> : <CaregiverResidentsView />;
}
