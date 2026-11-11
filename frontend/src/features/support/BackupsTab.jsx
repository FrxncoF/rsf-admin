import { useCallback, useEffect, useState } from 'react';
import { DatabaseBackup, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { api } from '@/lib/api';
import { formatBytes, formatStamp } from './supportUtils';

/** Respaldos de la base de datos: uno automático diario (después de las 03:00) + los manuales. */
export function BackupsTab() {
  const [state, setState] = useState({ data: [], loading: true, error: '' });
  const [creating, setCreating] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(() => {
    api
      .get('/support/backups')
      .then(({ data }) => setState({ data, loading: false, error: '' }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
  }, []);
  useEffect(load, [load]);

  async function create() {
    setCreating(true);
    setNotice('');
    setState((s) => ({ ...s, error: '' }));
    try {
      const { data } = await api.post('/support/backups');
      setNotice(`Respaldo creado: ${data.name} (${formatBytes(data.size)})`);
      load();
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
    } finally {
      setCreating(false);
    }
  }

  const { data, loading, error } = state;

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-500">
          Respaldo automático diario de la base de datos. Se guardan en el volumen <code className="font-mono text-xs">backups</code> del servidor.
          Las fotos están en el volumen <code className="font-mono text-xs">uploads</code>.
        </p>
        <Button onClick={create} loading={creating} className="shrink-0">
          <Plus className="size-4" /> Respaldar ahora
        </Button>
      </div>
      <Alert>{error}</Alert>
      {notice && <p className="rounded-lg bg-accent-50 px-4 py-2.5 text-sm text-accent-800 ring-1 ring-accent-200">{notice}</p>}
      {loading ? (
        <Spinner />
      ) : data.length === 0 ? (
        <Card>
          <EmptyState icon={DatabaseBackup} title="Aún no hay respaldos" description="El primero automático se crea después de las 03:00." />
        </Card>
      ) : (
        <Card className="divide-y divide-slate-100">
          {data.map((b, i) => (
            <div key={b.name} className="flex items-center gap-3 px-4 py-3 text-sm">
              <DatabaseBackup className="size-4 shrink-0 text-brand-600" />
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-700">{b.name}</span>
              {i === 0 && <Badge variant="success">Último</Badge>}
              <Badge variant={b.kind === 'auto' ? 'default' : 'brand'}>{b.kind === 'auto' ? 'Automático' : 'Manual'}</Badge>
              <span className="hidden w-36 text-right text-xs text-slate-500 sm:block">{formatStamp(b.created_at)}</span>
              <span className="w-16 text-right text-xs text-slate-500">{formatBytes(b.size)}</span>
            </div>
          ))}
        </Card>
      )}
      <p className="text-xs text-slate-400">
        Para restaurar en el servidor: <code className="font-mono">docker compose exec backend pg_restore --clean --if-exists -d $PGDATABASE /app/backups/ARCHIVO.dump</code>
      </p>
    </div>
  );
}
