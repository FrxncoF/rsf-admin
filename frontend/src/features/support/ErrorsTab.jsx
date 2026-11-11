import { useState } from 'react';
import { Bug, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import { formatStamp, Pager, usePaged } from './supportUtils';

/** Errores 500 del backend con su stack, para cruzar con "no me dejó guardar a las 15:20". */
export function ErrorsTab() {
  const { data, meta, loading, error, load } = usePaged('/support/errors', { pageSize: 30 });
  const [open, setOpen] = useState(null);

  if (loading && !data.length) return <Spinner />;

  return (
    <div className="space-y-3">
      <Alert>{error}</Alert>
      {data.length === 0 ? (
        <Card>
          <EmptyState icon={Bug} title="Sin errores registrados" description="Los errores internos del servidor aparecerán aquí." />
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100 overflow-hidden">
          {data.map((e) => (
            <div key={e.id}>
              <button
                type="button"
                onClick={() => setOpen(open === e.id ? null : e.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
              >
                <span className="w-36 shrink-0 font-mono text-xs text-slate-500">{formatStamp(e.created_at)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-xs text-slate-700">
                    <span className="font-semibold">{e.method}</span> {e.path}
                  </span>
                  <span className="block truncate text-sm text-red-700">{e.message}</span>
                  <span className="block text-xs text-slate-400">
                    {e.user_email ?? 'sin sesión'} · {e.ip}
                  </span>
                </span>
                <ChevronDown className={cn('size-4 shrink-0 text-slate-400 transition', open === e.id && 'rotate-180')} />
              </button>
              {open === e.id && (
                <pre className="max-h-80 overflow-auto bg-slate-900 px-4 py-3 text-[11px] leading-relaxed text-slate-100">{e.stack || e.message}</pre>
              )}
            </div>
          ))}
        </Card>
      )}
      <Pager meta={meta} onPage={load} />
    </div>
  );
}
