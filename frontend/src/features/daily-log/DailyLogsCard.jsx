import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronRight, ClipboardList, MessageSquarePlus, Pencil, StickyNote } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Alert, Spinner } from '@/components/ui/Feedback';
import { cn } from '@/lib/utils';
import { moodByValue } from './options';
import { dayAndDate, formatDay, formatTime, shortName } from './form';
import { alertsText, describeVitals, summarize } from './summary';
import { SHIFT_LABEL, dailyLogsApi } from './dailyLogsApi';
import { ChangeHistory } from './ChangeHistory';

const PAGE_SIZE = 10;

/** Fichas por turno del residente (más recientes primero). La del turno en curso se edita; las cerradas se leen. */
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
  // Mientras se pueda editar (turno en curso o margen tras el turno) se abre el formulario; si no, el resumen
  const openLog = (log) => (log.editable ? navigate(`/residentes/${resident.id}/ficha/${log.id}`) : setOpenId(log.id));

  return (
    <Card id="fichas-diarias" className="scroll-mt-20">
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <ClipboardList className="size-5 text-brand-600" /> Fichas diarias
        </CardTitle>
        {resident.is_active && (
          <Button size="sm" onClick={() => navigate(`/residentes/${resident.id}/ficha`)}>
            <Pencil className="size-4" /> Ficha del turno
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
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {items.map((log) => (
                <li key={log.id}>
                  <LogRow log={log} onOpen={() => openLog(log)} />
                </li>
              ))}
            </ul>
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

const isNight = (log) => log.shift === 'NOCHE' && !log.legacy;

const shiftLabel = (log) => (log.legacy ? `${formatTime(log.created_at)} hrs · formato anterior` : SHIFT_LABEL[log.shift]);

function LogRow({ log, onOpen }) {
  const d = log.data;
  const mood = moodByValue(d.mood);
  const vitals = describeVitals(d.vitals);
  const alerts = alertsText(d);

  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn('flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50', log.open && 'bg-accent-50/50')}
    >
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold text-slate-900">Ficha del {dayAndDate(log.shift_date)}</span>
          <span className="text-xs font-medium text-brand-700">{shiftLabel(log)}</span>
          {log.open ? (
            <span className="rounded-full bg-accent-100 px-2 py-0.5 text-[11px] font-medium text-accent-800">En curso</span>
          ) : log.editable ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">Se cierra a las {log.closes_at.slice(11)}</span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">Cerrada</span>
          )}
        </span>
        <span className="flex flex-wrap items-center gap-x-2 text-sm text-slate-800">
          {mood && <span title={mood.label}>{mood.emoji}</span>}
          {vitals ? (
            <span className="tabular-nums">{vitals}</span>
          ) : isNight(log) && d.notes ? (
            <span className="line-clamp-2 text-slate-600">{d.notes}</span>
          ) : (
            !alerts && <span className="text-slate-500">Ficha registrada</span>
          )}
        </span>
        {alerts && (
          <span className="mt-0.5 flex items-center gap-1 text-xs font-medium text-red-700">
            <AlertTriangle className="size-3.5" /> {alerts}
          </span>
        )}
      </span>
      <span className="hidden max-w-40 shrink-0 truncate text-xs text-slate-400 sm:block">{log.contributors.map((n) => shortName(n)).join(', ')}</span>
      {log.notes.length > 0 && (
        <span className="flex shrink-0 items-center gap-0.5 text-xs text-amber-700" title="Tiene notas">
          <StickyNote className="size-3.5" /> {log.notes.length}
        </span>
      )}
      {log.editable ? <Pencil className="size-4 shrink-0 text-brand-600" /> : <ChevronRight className="size-4 shrink-0 text-slate-300" />}
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
  const sections = summarize(log.data, { night: isNight(log) });

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
      title={`Ficha del ${dayAndDate(log.shift_date)} · ${log.legacy ? `${formatTime(log.created_at)} hrs` : SHIFT_LABEL[log.shift]}`}
      description={`Anotaron: ${log.contributors.join(', ')}`}
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

        {sections.length === 0 && <p className="text-sm text-slate-400">La ficha no tiene datos.</p>}


        {log.change_count > 0 && <ChangeHistory logId={log.id} count={log.change_count} />}

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
