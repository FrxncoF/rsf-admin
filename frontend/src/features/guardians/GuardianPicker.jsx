import { useEffect, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import { Input } from '@/components/ui/Form';
import { Spinner } from '@/components/ui/Feedback';
import { useDebouncedValue } from '@/lib/hooks';
import { formatPhone } from '@/lib/phone';
import { formatRut } from '@/lib/rut';
import { guardiansApi } from './guardiansApi';

/** Busca apoderados ya registrados por nombre, RUT o teléfono. `excludeIds` evita repetir. */
export function GuardianPicker({ onSelect, excludeIds = [], invalid, inputId }) {
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const [state, setState] = useState({ results: [], loading: false });

  useEffect(() => {
    if (debounced.trim().length < 2) return setState({ results: [], loading: false });
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    guardiansApi
      .list({ search: debounced.trim(), pageSize: 8 }, { signal: controller.signal })
      .then(({ data }) => setState({ results: data, loading: false }))
      .catch((err) => err.name !== 'AbortError' && setState({ results: [], loading: false }));
    return () => controller.abort();
  }, [debounced]);

  const results = state.results.filter((g) => !excludeIds.includes(g.id));
  const searched = debounced.trim().length >= 2;

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={inputId}
          type="search"
          placeholder="Buscar por nombre, RUT o teléfono"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-invalid={invalid || undefined}
          autoComplete="off"
        />
        {state.loading && <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2" />}
      </div>

      {searched && !state.loading && (
        <ul className="max-h-56 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">Sin coincidencias. Puedes crearlo como nuevo apoderado.</li>
          ) : (
            results.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onSelect(g)}
                  className="flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-brand-50"
                >
                  <UserRound className="mt-0.5 size-4 shrink-0 text-brand-600" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{g.full_name}</span>
                    <span className="block text-xs text-slate-500">
                      {formatPhone(g.phone)}
                      {g.rut && ` · ${formatRut(g.rut)}`}
                    </span>
                    {g.residents.length > 0 && (
                      <span className="block truncate text-xs text-accent-700">
                        Apoderado de: {g.residents.map((r) => `${r.first_name.split(' ')[0]} ${r.last_name.split(' ')[0]}`).join(', ')}
                      </span>
                    )}
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
