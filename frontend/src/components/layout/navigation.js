import { UserCog, Users } from 'lucide-react';
import { ROLES } from '@/features/auth/AuthContext';

// Ítems del sidebar. Agregar aquí los módulos de próximas fases.
export const NAV_ITEMS = [
  { to: '/residentes', label: 'Residentes', icon: Users, roles: [ROLES.ADMIN, ROLES.CUIDADORA] },
  { to: '/usuarios', label: 'Usuarios', icon: UserCog, roles: [ROLES.ADMIN] },
];

export const navItemsFor = (role) => NAV_ITEMS.filter((item) => item.roles.includes(role));

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Administradora',
  [ROLES.CUIDADORA]: 'Cuidadora',
};
