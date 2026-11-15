import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/Form';
import { Spinner } from '@/components/ui/Feedback';
import { useAuth } from '@/features/auth/AuthContext';
import { residentsApi } from '@/features/residents/residentsApi';
import { ResidentAvatar } from '@/features/residents/ResidentAvatar';
import { useDebouncedValue } from '@/lib/hooks';
import { roomLabel } from '@/lib/utils';

/** Buscador de residentes activos por nombre, habitación o RUT (el RUT solo para ADMIN), con foto. */
export function ResidentSearch({ siteId, onSelect, invalid, inputId }) {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search).trim();
  const [state, setState] = useState({ results: [], loading: false });

  useEffect(() => {
    if (!debounced) return setState({ results: [], loading: false });
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    residentsApi
      .list(
        { search: debounced, site_id: siteId ?? undefined, status: 'active', sort: 'name', pageSize: 8 },
        { signal: controller.signal },
      )
      .then(({ data }) => setState({ results: data, loading: false }))
      .catch((err) => err.name !== 'AbortError' && setState({ results: [], loading: false }));
    return () => controller.abort();
  }, [debounced, siteId]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={inputId}
          type="search"
          autoFocus
          autoComplete="off"
          placeholder={isAdmin ? 'Buscar por nombre, habitación o RUT' : 'Buscar por nombre o habitación'}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-invalid={invalid || undefined}
        />
        {state.loading && <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2" />}
      </div>

      {debounced && !state.loading && (
        <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {state.results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">Sin coincidencias.</li>
          ) : (
            state.results.map((r) => (
              <li key={r.id}>
                <button type="button" onClick={() => onSelect(r)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-50">
                  <ResidentAvatar resident={r} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {r.first_name} {r.last_name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {r.site_name} · {roomLabel(r)}
                    </span>
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
