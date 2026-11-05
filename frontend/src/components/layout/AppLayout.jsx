import { useCallback, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu } from 'lucide-react';
import { DesktopSidebar } from './Sidebar';
import { MobileDrawer } from './MobileDrawer';
import { SiteSelector, UfBadge } from './TopBar';
import { SiteProvider } from '@/features/sites/SiteContext';
import { useAuth } from '@/features/auth/AuthContext';

const COLLAPSE_KEY = 'rsf:sidebar-collapsed';

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === '1');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();
  const { isAdmin } = useAuth();

  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const toggleCollapse = () =>
    setCollapsed((prev) => {
      localStorage.setItem(COLLAPSE_KEY, prev ? '0' : '1');
      return !prev;
    });
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <SiteProvider>
      <div className="flex min-h-dvh">
        <DesktopSidebar collapsed={collapsed} onToggleCollapse={toggleCollapse} />
        <MobileDrawer open={drawerOpen} onClose={closeDrawer} />

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Barra superior solo en móvil */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-slate-200 bg-white/90 px-2 backdrop-blur lg:hidden">
            <button
              onClick={() => setDrawerOpen(true)}
              aria-label="Abrir menú"
              className="rounded-lg p-2.5 text-slate-700 hover:bg-slate-100 active:bg-slate-200"
            >
              <Menu className="size-6" />
            </button>
            <img src="/icons/emblem.png" alt="" className="size-8" />
            <span className="hidden truncate font-semibold text-brand-700 sm:inline">
              Residencia <span className="text-accent-600">San Francisco</span>
            </span>
            <SiteSelector compact className="ml-auto w-44 sm:w-52" />
          </header>

          {/* Barra superior de escritorio: sede global + UF del día (admin) */}
          <div className="hidden items-center justify-between gap-4 border-b border-slate-200 bg-white px-8 py-2.5 lg:flex">
            <SiteSelector />
            {isAdmin && <UfBadge />}
          </div>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </SiteProvider>
  );
}
