import { useState } from 'react';
import { KeyRound, Search } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Form';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useDebouncedValue } from '@/lib/hooks';
import { formatStamp, Pager, usePaged } from './supportUtils';

const REASONS = {
  ok: { label: 'OK', variant: 'success' },
  bad_credentials: { label: 'Clave/correo incorrecto', variant: 'warning' },
  inactive: { label: 'Cuenta desactivada', variant: 'muted' },
  rate_limited: { label: 'Bloqueado por intentos', variant: 'danger' },
  locked: { label: 'Cuenta bloqueada 15 min', variant: 'danger' },
};

/** Historial de inicios de sesión: detectar intentos raros o a quien olvidó su clave. */
export function LoginsTab() {
  const [search, setSearch] = useState('');
  const [onlyFailed, setOnlyFailed] = useState(false);
  const debounced = useDebouncedValue(search).trim();
  const { data, meta, loading, error, load } = usePaged('/support/logins', {
    search: debounced || undefined,
    onlyFailed: String(onlyFailed),
    pageSize: 50,
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <Input type="search" placeholder="Filtrar por correo o IP" className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="size-4 accent-brand-600" checked={onlyFailed} onChange={(e) => setOnlyFailed(e.target.checked)} />
          Solo fallidos
        </label>
      </div>
      <Alert>{error}</Alert>
      {loading && !data.length ? (
        <Spinner />
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon={KeyRound} title="Sin registros" />
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Fecha</th>
                <th className="px-4 py-2 font-medium">Correo</th>
                <th className="px-4 py-2 font-medium">Resultado</th>
                <th className="px-4 py-2 font-medium">IP</th>
                <th className="px-4 py-2 font-medium">Navegador</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((l) => {
                const reason = REASONS[l.reason] ?? { label: l.reason, variant: 'default' };
                return (
                  <tr key={l.id} className={l.success ? '' : 'bg-red-50/40'}>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-600">{formatStamp(l.created_at)}</td>
                    <td className="px-4 py-2">
                      <span className="block text-slate-900">{l.email ?? '—'}</span>
                      {l.full_name && <span className="block text-xs text-slate-400">{l.full_name}</span>}
                    </td>
                    <td className="px-4 py-2">
                      <Badge variant={reason.variant}>{reason.label}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 font-mono text-xs text-slate-600">{l.ip}</td>
                    <td className="max-w-xs truncate px-4 py-2 text-xs text-slate-400" title={l.user_agent}>
                      {l.user_agent}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      <Pager meta={meta} onPage={load} />
    </div>
  );
}
