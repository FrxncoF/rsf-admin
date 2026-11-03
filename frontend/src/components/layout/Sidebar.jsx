import { NavLink } from 'react-router-dom';
import { LogOut, Settings, X } from 'lucide-react';
import { cn, initials } from '@/lib/utils';
import { useAuth } from '@/features/auth/AuthContext';
import { navItemsFor, ROLE_LABELS } from './navigation';

const navLinkClass =
  (collapsed) =>
  ({ isActive }) =>
    cn(
      'flex items-center gap-3 rounded-lg border-l-4 px-3 py-3 text-base font-medium transition-colors lg:py-2.5 lg:text-sm',
      collapsed && 'justify-center px-0',
      isActive
        ? 'border-accent-500 bg-brand-50 text-brand-700'
        : 'border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    );

/** Contenido compartido entre el sidebar de escritorio y el drawer móvil. */
export function SidebarContent({ collapsed = false, onNavigate, onToggleCollapse, onClose }) {
  const { user, logout } = useAuth();
  const items = navItemsFor(user.role);
  const [first = '', ...rest] = user.full_name.split(' ');

  return (
    <div className="flex h-full flex-col">
      <div className={cn('flex h-16 items-center gap-2 border-b border-slate-200', collapsed ? 'justify-center' : 'px-3')}>
        {onToggleCollapse ? (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            aria-expanded={!collapsed}
            className="shrink-0 rounded-lg p-1 transition hover:bg-slate-100"
          >
            <img src="/icons/emblem.png" alt="" className="size-9" />
          </button>
        ) : (
          <img src="/icons/emblem.png" alt="" className="size-9 shrink-0" />
        )}
        {!collapsed && (
          <>
            <p className="min-w-0 flex-1 text-[0.95rem] font-semibold leading-tight">
              <span className="block text-brand-700">Residencia</span>
              <span className="block text-accent-600">San Francisco</span>
            </p>
            {(onToggleCollapse || onClose) && (
              <button
                onClick={onToggleCollapse ?? onClose}
                aria-label={onToggleCollapse ? 'Colapsar menú' : 'Cerrar menú'}
                className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="size-5" />
              </button>
            )}
          </>
        )}
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3" aria-label="Principal">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            title={collapsed ? label : undefined}
            className={navLinkClass(collapsed)}
          >
            <Icon className="size-5 shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-1 border-t border-slate-200 p-3 pb-safe lg:pb-3">
        <div className={cn('flex items-center gap-3 px-2 py-2', collapsed && 'justify-center px-0')}>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
            {initials(first, rest.join(' '))}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{user.full_name}</p>
              <p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
            </div>
          )}
        </div>
        <NavLink
          to="/configuracion"
          onClick={onNavigate}
          title={collapsed ? 'Configuración' : undefined}
          className={navLinkClass(collapsed)}
        >
          <Settings className="size-5 shrink-0" />
          {!collapsed && 'Configuración'}
        </NavLink>
        {/* <button
          onClick={logout}
          title={collapsed ? 'Cerrar sesión' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-lg border-l-4 border-transparent px-3 py-3 text-base font-medium text-slate-600 hover:bg-red-50 hover:text-red-700 lg:py-2.5 lg:text-sm',
            collapsed && 'justify-center px-0',
          )}
        >
          <LogOut className="size-5 shrink-0" />
          {!collapsed && 'Cerrar sesión'}
        </button> */}
      </div>
    </div>
  );
}

/** Sidebar fijo de escritorio (lg+), colapsable. */
export function DesktopSidebar({ collapsed, onToggleCollapse }) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh shrink-0 border-r border-slate-200 bg-white transition-[width] duration-200 lg:block',
        collapsed ? 'w-[4.5rem]' : 'w-64',
      )}
    >
      <SidebarContent collapsed={collapsed} onToggleCollapse={onToggleCollapse} />
    </aside>
  );
}
