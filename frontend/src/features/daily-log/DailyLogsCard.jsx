import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, ClipboardList, MessageSquarePlus, Plus, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import { moodByValue } from './options';
import { formatDay, formatTime, shortName } from './form';
import { alertsText, describeVitals, summarize } from './summary';
import { dailyLogsApi } from './dailyLogsApi';

const PAGE_SIZE = 10;
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA'); // YYYY-MM-DD local

function dayTitle(iso) {
  const key = dayKey(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (key === dayKey(today)) return 'Hoy';
  if (key === dayKey(yesterday)) return 'Ayer';
  return formatDay(iso);
}

/** Historial de fichas diarias del residente (más recientes primero). */
export default function DailyLogsCard({ resident }) {
  const [state, setState] = useState({ items: [], meta: null, loading: true, error: '' });
  const [openId, setOpenId] = useState(null);
  const navigate = useNavigate();

  const load = useCallback(
    (page = 1) => {
      setState((s) => ({ ...s, loading: true }));
      dailyLogsApi
        .list({ resident_id: resident.id, page, pageSize: PAGE_SIZE })
        .then(({ data, meta }) =>
          setState((s) => ({ items: page === 1 ? data : [...s.items, ...data], meta, loading: false, error: '' })),
        )
        .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
    },
    [resident.id],
  );

  useEffect(() => load(1), [load]);

  const { items, meta, loading, error } = state;
  const open = items.find((l) => l.id === openId);

  // Agrupar por día
  const groups = [];
  for (const log of items) {
    const key = dayKey(log.created_at);
    if (groups.at(-1)?.key !== key) groups.push({ key, title: dayTitle(log.created_at), logs: [] });
    groups.at(-1).logs.push(log);
  }

  return (
    <Card id="fichas-diarias" className="scroll-mt-20">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="size-5 text-brand-600" /> Fichas diarias
        </CardTitle>
        {resident.is_active && (
          <Button size="sm" onClick={() => navigate(`/residentes/${resident.id}/ficha/nueva`)}>
            <Plus className="size-4" /> Nueva ficha
          </Button>
        )}
      </CardHeader>

      <div className="px-5 py-4">
        <Alert>{error}</Alert>
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Aún no hay fichas registradas.</p>
        ) : (
          <div className="space-y-4">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.title}</p>
                <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
                  {g.logs.map((log) => (
                    <li key={log.id}>
                      <LogRow log={log} onOpen={() => setOpenId(log.id)} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            {meta && meta.page < meta.totalPages && (
              <Button variant="outline" className="w-full" loading={loading} onClick={() => load(meta.page + 1)}>
                Ver fichas anteriores
              </Button>
            )}
          </div>
        )}
      </div>

      <LogDialog
        log={open}
        canAddNote={resident.is_active}
        onClose={() => setOpenId(null)}
        onUpdated={(updated) => setState((s) => ({ ...s, items: s.items.map((l) => (l.id === updated.id ? updated : l)) }))}
      />
    </Card>
  );
}

function LogRow({ log, onOpen }) {
  const d = log.data;
  const mood = moodByValue(d.mood);
  const vitals = describeVitals(d.vitals);
  const alerts = alertsText(d);

  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50">
      <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-brand-700">{formatTime(log.created_at)}</span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-slate-800">
          {mood && <span title={mood.label}>{mood.emoji}</span>}
          {vitals ? <span className="tabular-nums">{vitals}</span> : !alerts && <span className="text-slate-500">Ficha registrada</span>}
        </span>
        {alerts && (
          <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-700">
            <AlertTriangle className="size-3.5" /> {alerts}
          </span>
        )}
      </span>
      <span className="hidden shrink-0 text-xs text-slate-400 sm:block">{shortName(log.author)}</span>
      {log.notes.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-xs text-amber-700" title="Tiene notas">
          <StickyNote className="size-3.5" /> {log.notes.length}
        </span>
      )}
      <ChevronRight className="size-4 shrink-0 text-slate-300" />
    </button>
  );
}

const TONE_TEXT = {
  good: 'text-accent-800',
  warn: 'text-amber-700',
  bad: 'text-red-700',
};

function LogDialog({ log, canAddNote, onClose, onUpdated }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setNote('');
    setError('');
  }, [log?.id]);

  if (!log) return null;
  const sections = summarize(log.data);

  async function addNote(e) {
    e.preventDefault();
    if (!note.trim()) return;
    setSaving(true);
    setError('');
    try {
      onUpdated(await dailyLogsApi.addNote(log.id, note.trim()));
      setNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Ficha · ${formatDay(log.created_at)} · ${formatTime(log.created_at)} hrs`}
      description={`Registrada por ${log.author}`}
    >
      <div className="space-y-5">
        {sections.map((s) => (
          <section key={s.key}>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{s.title}</h4>
            <dl className="grid gap-x-4 gap-y-1.5 text-sm sm:grid-cols-2">
              {s.items.map((item) => (
                <div key={item.label} className={cn('flex gap-2', item.wide && 'sm:col-span-2')}>
                  <dt className="shrink-0 text-slate-500">{item.label}:</dt>
                  <dd className={cn('font-medium text-slate-900', TONE_TEXT[item.tone])}>{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}

        <section className="border-t border-slate-200 pt-4">
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Notas</h4>
          {log.notes.length === 0 ? (
            <p className="text-sm text-slate-400">Sin notas.</p>
          ) : (
            <ul className="space-y-2">
              {log.notes.map((n) => (
                <li key={n.id} className="rounded-lg bg-amber-50 px-3 py-2 text-sm ring-1 ring-amber-200">
                  <p className="text-slate-900">{n.body}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDay(n.created_at)} {formatTime(n.created_at)} · {n.author}
                  </p>
                </li>
              ))}
            </ul>
          )}

          {canAddNote && (
            <form onSubmit={addNote} className="mt-3 space-y-2">
              <Alert>{error}</Alert>
              <textarea
                rows={2}
                maxLength={300}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Agregar una corrección o aclaración"
                className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
              <Button type="submit" size="sm" variant="outline" loading={saving} disabled={!note.trim()}>
                <MessageSquarePlus className="size-4" /> Agregar nota
              </Button>
            </form>
          )}
        </section>
      </div>
    </Dialog>
  );
}
