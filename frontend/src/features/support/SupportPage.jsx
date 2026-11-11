import { useCallback, useState } from 'react';
import { Activity, Bug, DatabaseBackup, KeyRound, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusTab } from './StatusTab';
import { ErrorsTab } from './ErrorsTab';
import { LoginsTab } from './LoginsTab';
import { BackupsTab } from './BackupsTab';
import { ConfigTab } from './ConfigTab';

const TABS = [
  { key: 'status', label: 'Estado', icon: Activity, Component: StatusTab },
  { key: 'errors', label: 'Errores', icon: Bug, Component: ErrorsTab },
  { key: 'logins', label: 'Accesos', icon: KeyRound, Component: LoginsTab },
  { key: 'backups', label: 'Respaldos', icon: DatabaseBackup, Component: BackupsTab },
  { key: 'config', label: 'Configuración', icon: Settings2, Component: ConfigTab },
];
const TAB_KEY = 'rsf:support-tab';

/** Sección técnica, solo para el rol SOPORTE. */
export default function SupportPage() {
  const [tab, setTab] = useState(() => {
    try {
      return TABS.some((t) => t.key === localStorage.getItem(TAB_KEY)) ? localStorage.getItem(TAB_KEY) : 'status';
    } catch {
      return 'status';
    }
  });
  const select = useCallback((key) => {
    setTab(key);
    try {
      localStorage.setItem(TAB_KEY, key);
    } catch {
      /* sin almacenamiento */
    }
  }, []);
  const { Component } = TABS.find((t) => t.key === tab);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Soporte</h1>
        <p className="mt-1 text-sm text-slate-500">Diagnóstico, registros y configuración del sistema</p>
      </div>
      <nav className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]" aria-label="Secciones de soporte">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => select(key)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition',
              tab === key ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
            )}
          >
            <Icon className="size-4" /> {label}
          </button>
        ))}
      </nav>
      <Component />
    </div>
  );
}
