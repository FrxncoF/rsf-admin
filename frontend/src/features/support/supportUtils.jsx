import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';

/** Carga paginada reutilizable para las pestañas con tablas. */
export function usePaged(path, params) {
  const [state, setState] = useState({ data: [], meta: null, loading: true, error: '' });
  const key = JSON.stringify(params);
  const load = useCallback(
    (page = 1) => {
      setState((s) => ({ ...s, loading: true }));
      api
        .get(path, { params: { ...JSON.parse(key), page } })
        .then(({ data, meta }) => setState({ data, meta, loading: false, error: '' }))
        .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
    },
    [path, key],
  );
  useEffect(() => load(1), [load]);
  return { ...state, load };
}

export const formatBytes = (bytes) => {
  if (bytes == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toLocaleString('es-CL', { maximumFractionDigits: i ? 1 : 0 })} ${units[i]}`;
};

export const formatStamp = (iso) =>
  iso
    ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'medium', hour12: false }).format(new Date(iso))
    : '—';

export function Pager({ meta, onPage }) {
  if (!meta || meta.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between text-sm text-slate-600">
      <span>
        Página {meta.page} de {meta.totalPages} · {meta.total} registros
      </span>
      <div className="flex gap-2">
        <button type="button" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40">
          Anterior
        </button>
        <button type="button" disabled={meta.page >= meta.totalPages} onClick={() => onPage(meta.page + 1)} className="rounded-lg px-3 py-1.5 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-40">
          Siguiente
        </button>
      </div>
    </div>
  );
}
