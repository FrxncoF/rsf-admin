import { Building2, TrendingUp } from 'lucide-react';
import { cn, formatDate } from '@/lib/utils';
import { formatUfValue, useUf } from '@/lib/money';
import { useSites } from '@/features/sites/SiteContext';

/** Selector global de sede. `compact` = <select> para la barra móvil. */
export function SiteSelector({ compact = false, className }) {
  const { sites, siteId, setSiteId } = useSites();
  if (sites.length === 0) return null;

  if (compact) {
    return (
      <label className={cn('relative flex items-center', className)}>
        <Building2 className="pointer-events-none absolute left-2.5 size-4 text-brand-600" />
        <span className="sr-only">Sede</span>
        <select
          value={siteId ?? ''}
          onChange={(e) => setSiteId(e.target.value ? Number(e.target.value) : null)}
          className="h-10 w-full appearance-none truncate rounded-lg border border-slate-300 bg-white pl-8 pr-3 text-sm font-medium text-slate-800 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        >
          <option value="">Todas las sedes</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </label>
    );
  }

  const options = [{ id: null, name: 'Todas' }, ...sites];
  return (
    <div role="radiogroup" aria-label="Sede" className={cn('inline-flex rounded-xl bg-slate-100 p-1', className)}>
      {options.map((s) => {
        const active = siteId === s.id;
        return (
          <button
            key={s.id ?? 'all'}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setSiteId(s.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition',
              active ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900',
            )}
          >
            {s.id && <Building2 className={cn('size-4', active ? 'text-accent-600' : 'text-slate-400')} />}
            {s.name}
          </button>
        );
      })}
    </div>
  );
}

/** Valor de la UF del día. */
export function UfBadge({ className }) {
  const { uf, error } = useUf();
  if (error) return <span className={cn('text-xs text-slate-400', className)}>UF no disponible</span>;
  if (!uf) return null;
  return (
    <div
      className={cn('flex items-center gap-2 rounded-xl bg-accent-50 px-3 py-1.5 text-sm text-accent-900 ring-1 ring-accent-200', className)}
      title={`Fuente: ${uf.source}`}
    >
      <TrendingUp className="size-4 text-accent-600" />
      <span>
        UF hoy <span className="font-semibold tabular-nums">{formatUfValue(uf.value)}</span>
      </span>
      <span className="text-xs text-accent-700/80">
        {formatDate(uf.date)} · {uf.source.startsWith('CMF') ? 'CMF' : 'BCCh'}
      </span>
    </div>
  );
}
