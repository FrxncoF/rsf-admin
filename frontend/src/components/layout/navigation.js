import { Contact, DoorOpen, LifeBuoy, UserCog, Users } from 'lucide-react';
import { hasRole, ROLES } from '@/features/auth/AuthContext';

// Ítems del sidebar. Agregar aquí los módulos de próximas fases.
export const NAV_ITEMS = [
  { to: '/residentes', label: 'Residentes', icon: Users, roles: [ROLES.ADMIN, ROLES.CUIDADORA] },
  { to: '/visitas', label: 'Visitas', icon: DoorOpen, roles: [ROLES.ADMIN, ROLES.CUIDADORA] },
  { to: '/apoderados', label: 'Apoderados', icon: Contact, roles: [ROLES.ADMIN] },
  { to: '/usuarios', label: 'Usuarios', icon: UserCog, roles: [ROLES.ADMIN] },
  { to: '/soporte', label: 'Soporte', icon: LifeBuoy, roles: [ROLES.SOPORTE] },
];

export const navItemsFor = (role) => NAV_ITEMS.filter((item) => hasRole({ role }, item.roles));

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administradora',
  [ROLES.CUIDADORA]: 'Cuidadora',
  [ROLES.SOPORTE]: 'Soporte',
};
