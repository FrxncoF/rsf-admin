import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

/**
 * Configuración editable desde Soporte: aviso superior y catálogos (isapres, ambulancias).
 * Se carga sin sesión para que el aviso también aparezca en el login.
 */
const AppConfigContext = createContext(null);
const EMPTY = { banner: null, catalogs: { isapres: [], ambulances: [] } };
const DISMISS_KEY = 'rsf:banner-dismissed';

export function AppConfigProvider({ children }) {
  const [config, setConfig] = useState(EMPTY);

  const reload = useCallback(
    () =>
      api
        .get('/settings/public')
        .then(({ data }) => setConfig(data))
        .catch(() => {}),
    [],
  );

  useEffect(() => {
    reload();
    // El aviso puede activarse mientras alguien usa el sistema
    const id = setInterval(reload, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [reload]);

  const value = useMemo(() => ({ ...config, reload }), [config, reload]);
  return <AppConfigContext.Provider value={value}>{children}</AppConfigContext.Provider>;
}

export function useAppConfig() {
  const ctx = useContext(AppConfigContext);
  if (!ctx) throw new Error('useAppConfig debe usarse dentro de <AppConfigProvider>');
  return ctx;
}

/** Opciones activas de un catálogo, más el valor actual aunque esté desactivado (para no perderlo al editar). */
export function catalogOptions(items, current) {
  return items.filter((i) => i.active || i.value === current);
}

export const catalogLabel = (items, value) => items.find((i) => i.value === value)?.label ?? value ?? null;

const TONES = {
  info: 'bg-brand-600 text-white',
  success: 'bg-accent-600 text-white',
  warning: 'bg-amber-400 text-amber-950',
  danger: 'bg-red-600 text-white',
};

/** Aviso fijo arriba de todo. Si es descartable, se oculta hasta que soporte publique otro. */
export function TopBanner() {
  const { banner } = useAppConfig();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY);
    } catch {
      return null;
    }
  });

  if (!banner || (banner.dismissible && dismissed === banner.id)) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, banner.id);
    } catch {
      /* sin almacenamiento: se oculta solo en esta vista */
    }
    setDismissed(banner.id);
  };

  return (
    <div role="status" className={cn('relative z-40 flex items-center gap-3 px-4 py-2 text-sm font-medium', TONES[banner.tone] ?? TONES.info)}>
      <p className="flex-1 text-center">{banner.message}</p>
      {banner.dismissible && (
        <button type="button" onClick={dismiss} aria-label="Cerrar aviso" className="rounded p-1 opacity-80 hover:bg-black/10 hover:opacity-100">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
