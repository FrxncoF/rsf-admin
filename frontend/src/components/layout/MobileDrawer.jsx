import { useEffect } from 'react';
import { cn } from '@/lib/utils';
import { SidebarContent } from './Sidebar';

/** Menú lateral deslizable para móvil (< lg). */
export function MobileDrawer({ open, onClose }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={cn('fixed inset-0 z-40 lg:hidden', !open && 'pointer-events-none')} aria-hidden={!open}>
      <div
        className={cn('absolute inset-0 bg-slate-900/40 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
      />
      <aside
        className={cn(
          'absolute inset-y-0 left-0 w-[82%] max-w-xs bg-white shadow-xl transition-transform duration-200 ease-out',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label="Menú"
      >
        <SidebarContent onNavigate={onClose} onClose={onClose} showUf />
      </aside>
    </div>
  );
}
