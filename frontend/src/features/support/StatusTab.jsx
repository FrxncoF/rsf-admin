import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { api } from '@/lib/api';
import { formatUfValue } from '@/lib/money';
import { ROLE_LABELS } from '@/components/layout/navigation';
import { formatBytes, formatStamp } from './supportUtils';

function formatUptime(seconds) {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return [d && `${d} d`, h && `${h} h`, `${m} min`].filter(Boolean).join(' ');
}

export function StatusTab() {
  const [state, setState] = useState({ data: null, loading: true, error: '' });

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    api
      .get('/support/status')
      .then(({ data }) => setState({ data, loading: false, error: '' }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
  }, []);
  useEffect(load, [load]);

  // Los conectados cambian solos: se actualiza cada minuto mientras la pestaña está visible
  useEffect(() => {
    const id = setInterval(() => document.visibilityState === 'visible' && load(), 60_000);
    return () => clearInterval(id);
  }, [load]);

  const { data, loading, error } = state;
  if (!data) return loading ? <Spinner /> : <Alert>{error}</Alert>;
  const { app, migrations, storage, backups, uf, counts, presence } = data;
  const backupAgeH = backups.last ? (Date.now() - new Date(backups.last.created_at)) / 3_600_000 : null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={load} loading={loading}>
          <RefreshCw className="size-4" /> Actualizar
        </Button>
      </div>
      <Alert>{error}</Alert>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Conectados ahora" value={counts.online_users} online />
        <Stat label="Errores (24 h)" value={counts.errors_24h} warn={counts.errors_24h > 0} />
        <Stat label="Accesos fallidos (24 h)" value={counts.failed_logins_24h} warn={counts.failed_logins_24h >= 10} />
        <Stat label="Cuentas habilitadas" value={counts.active_users} />
        <Stat label="Residentes activos" value={counts.active_residents} />
      </div>

      <PresencePanel users={presence} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Aplicación">
          <Row label="Versión (commit)" value={app.version || 'sin GIT_SHA'} mono />
          <Row label="Imagen construida" value={formatStamp(app.build_date)} />
          <Row label="Encendido desde" value={`${formatStamp(app.started_at)} (${formatUptime(app.uptime_seconds)})`} />
          <Row label="Node.js" value={app.node} mono />
          <Row label="Memoria (RSS)" value={`${app.memory_mb} MB`} />
        </Panel>

        <Panel title="Almacenamiento">
          <Row label="Base de datos" value={formatBytes(storage.database_bytes)} />
          <Row label="Motor" value={storage.postgres} mono />
          <Row label="Fotos" value={`${formatBytes(storage.photos_bytes)} · ${storage.photos_files} archivos`} />
          <Row label="Respaldos" value={`${formatBytes(storage.backups_bytes)} · ${backups.count}/${backups.keep}`} />
          <Row
            label="Último respaldo"
            value={backups.last ? `${formatStamp(backups.last.created_at)} (${backups.last.kind})` : 'Ninguno'}
            status={backupAgeH == null || backupAgeH > 30 ? 'warn' : 'ok'}
          />
        </Panel>

        <Panel title="Migraciones">
          <Row
            label="Estado"
            value={migrations.pending.length ? `${migrations.pending.length} pendiente(s)` : 'Al día'}
            status={migrations.pending.length ? 'warn' : 'ok'}
          />
          {migrations.pending.map((m) => (
            <Row key={m} label="Pendiente" value={m} mono status="warn" />
          ))}
          {migrations.applied.map((m) => (
            <Row key={m.name} label={formatStamp(m.applied_at)} value={m.name} mono />
          ))}
        </Panel>

        <Panel title="UF">
          <Row label="API key CMF" value={uf.cmfConfigured ? 'Configurada' : 'No configurada'} status={uf.cmfConfigured ? 'ok' : 'warn'} />
          <Row label="Fuente actual" value={uf.cached?.source ?? '—'} status={uf.cached?.source?.startsWith('CMF') ? 'ok' : uf.cached ? 'warn' : undefined} />
          <Row label="Último valor" value={uf.cached ? `${formatUfValue(uf.cached.value)} · ${uf.cached.date}` : 'Sin consultar aún'} />
          <Row label="Consultado" value={formatStamp(uf.cached?.fetchedAt)} />
          <Row
            label="Último error CMF"
            value={uf.lastCmfError ? `${formatStamp(uf.lastCmfError.at)} · ${uf.lastCmfError.message}` : 'Ninguno'}
            status={uf.lastCmfError ? 'warn' : undefined}
            mono={Boolean(uf.lastCmfError)}
          />
          {uf.lastError && (
            <Row label="Fallo total" value={`${formatStamp(uf.lastError.at)} · ${uf.lastError.message}`} status="warn" mono />
          )}
        </Panel>
      </div>
    </div>
  );
}

function Stat({ label, value, warn, online }) {
  return (
    <Card className="px-4 py-3">
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        {online && <span className="size-2 animate-pulse rounded-full bg-accent-500" aria-hidden="true" />}
        {label}
      </p>
      <p className={warn ? 'text-2xl font-semibold text-amber-600' : online ? 'text-2xl font-semibold text-accent-700' : 'text-2xl font-semibold text-slate-900'}>
        {value}
      </p>
    </Card>
  );
}

/** "hace 5 min", "hace 3 h", "hace 2 días" */
function timeAgo(iso) {
  const min = Math.max(0, Math.round((Date.now() - new Date(iso)) / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? 'día' : 'días'}`;
}

/** Quién está conectado ahora (actividad en los últimos 3 min) y la última conexión del resto. */
function PresencePanel({ users }) {
  const online = users.filter((u) => u.online);
  const offline = users.filter((u) => !u.online);
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">Usuarios conectados</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 py-2">
        {online.length === 0 ? (
          <p className="text-sm text-slate-500">Nadie conectado en este momento.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {online.map((u) => (
              <li key={u.id} className="flex items-center gap-2 rounded-full bg-accent-50 px-3 py-1.5 text-sm ring-1 ring-accent-200">
                <span className="size-2 rounded-full bg-accent-500" aria-hidden="true" />
                <span className="font-medium text-slate-900">{u.full_name}</span>
                <span className="text-xs text-slate-500">{ROLE_LABELS[u.role] ?? u.role}</span>
              </li>
            ))}
          </ul>
        )}
        {offline.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer text-xs font-medium text-slate-500 hover:text-slate-800">
              Última conexión del resto ({offline.length})
            </summary>
            <dl className="mt-2 divide-y divide-slate-100 text-sm">
              {offline.map((u) => (
                <div key={u.id} className="flex items-center justify-between gap-4 py-2">
                  <dt className="min-w-0 truncate text-slate-700">
                    {u.full_name} <span className="text-xs text-slate-400">· {ROLE_LABELS[u.role] ?? u.role}</span>
                  </dt>
                  <dd className="shrink-0 text-xs text-slate-500" title={u.last_seen_at ? formatStamp(u.last_seen_at) : undefined}>
                    {u.last_seen_at ? timeAgo(u.last_seen_at) : 'Sin registro aún'}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        )}
      </CardContent>
    </Card>
  );
}

function Panel({ title, children }) {
  return (
    <Card>
      <CardHeader className="py-3">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="py-2">
        <dl className="divide-y divide-slate-100 text-sm">{children}</dl>
      </CardContent>
    </Card>
  );
}

function Row({ label, value, mono, status }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <dt className="shrink-0 text-slate-500">{label}</dt>
      <dd className={`flex min-w-0 items-center gap-1.5 text-right text-slate-900 ${mono ? 'break-all font-mono text-xs' : ''}`}>
        {status === 'ok' && <CheckCircle2 className="size-4 shrink-0 text-accent-600" />}
        {status === 'warn' && <AlertTriangle className="size-4 shrink-0 text-amber-500" />}
        {value}
      </dd>
    </div>
  );
}
