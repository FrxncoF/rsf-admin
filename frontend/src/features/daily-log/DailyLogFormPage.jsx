import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, ClipboardList, CloudOff, Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { residentsApi } from '@/features/residents/residentsApi';
import { cn, locationLabel } from '@/lib/utils';
import { MoodAvatar } from './MoodAvatar';
import { moodByValue, SECTIONS } from './options';
import { EMPTY_LOG, applyChanges, changesBetween, dayAndDate, formatTime, fromData, hasInvalidVitals, shortName } from './form';
import { SHIFT_LABEL, dailyLogsApi } from './dailyLogsApi';
import { HygieneSection, IntakeSection, SkinSection, VitalsSection, WellbeingSection } from './sections';

const AUTOSAVE_MS = 1200;
const RETRY_MS = 5000;

/**
 * Ficha del turno: el mismo formulario de siempre, pero se va completando durante el turno.
 * Cada cambio se guarda solo (solo los datos tocados, para no pisar lo que anotó otra cuidadora)
 * y la ficha se cierra cuando termina el turno. Sin `logId` abre la ficha del turno en curso.
 */
export default function DailyLogFormPage() {
  const { id, logId: logIdParam } = useParams();
  const navigate = useNavigate();
  const [resident, setResident] = useState(null);
  const [info, setInfo] = useState(null); // { shift, shift_date, start, end, open, editable, contributors }
  const [loadError, setLoadError] = useState('');
  const [log, setLog] = useState(EMPTY_LOG);
  const [status, setStatus] = useState({ state: 'idle' }); // idle | saving | saved | error | closed
  const [leaving, setLeaving] = useState(false);

  const baseRef = useRef(EMPTY_LOG); // lo último que confirmó el servidor (formato formulario)
  const logRef = useRef(EMPTY_LOG); // lo que hay en pantalla
  const logIdRef = useRef(logIdParam ?? null);
  const savingRef = useRef(false);
  const timerRef = useRef(null);
  const closedRef = useRef(false);
  logRef.current = log;

  const applyServerLog = useCallback((serverLog) => {
    const form = fromData(serverLog.data);
    baseRef.current = form;
    logIdRef.current = serverLog.id;
    setInfo(serverLog);
    return form;
  }, []);

  // Carga: residente + ficha (la del turno en curso o una específica)
  useEffect(() => {
    let alive = true;
    Promise.all([residentsApi.get(id), logIdParam ? dailyLogsApi.get(logIdParam) : dailyLogsApi.current(id)])
      .then(([r, data]) => {
        if (!alive) return;
        setResident(r);
        if (logIdParam) {
          if (!data.editable) {
            closedRef.current = true;
            setStatus({ state: 'closed' });
          }
          setLog(applyServerLog(data));
        } else if (data.log) {
          setLog(applyServerLog(data.log));
        } else {
          setInfo({ ...data, open: true, editable: true, contributors: [] });
        }
      })
      .catch((err) => alive && setLoadError(err.status === 404 ? 'not-found' : err.message));
    return () => {
      alive = false;
    };
  }, [id, logIdParam, applyServerLog]);

  const save = useCallback(async () => {
    clearTimeout(timerRef.current);
    if (savingRef.current) return;
    const sent = logRef.current;
    const patch = changesBetween(baseRef.current, sent);
    if (Object.keys(patch).length === 0) return;
    savingRef.current = true;
    setStatus({ state: 'saving' });
    try {
      const serverLog = logIdRef.current ? await dailyLogsApi.save(logIdRef.current, patch) : await dailyLogsApi.saveCurrent(id, patch);
      const server = applyServerLog(serverLog);
      // Lo que se escribió mientras se guardaba se mantiene encima de la versión del servidor
      setLog(applyChanges(server, sent, logRef.current));
      setStatus({ state: 'saved', at: new Date().toISOString() });
    } catch (err) {
      if (err.status === 409) {
        closedRef.current = true;
        setStatus({ state: 'closed', message: err.message });
        setInfo((i) => (i ? { ...i, open: false, editable: false } : i));
      } else {
        setStatus({ state: 'error', message: err.message });
        timerRef.current = setTimeout(() => save(), RETRY_MS); // reintento automático (señal débil)
      }
    } finally {
      savingRef.current = false;
    }
  }, [id, applyServerLog]);

  // Guardado automático un momento después de cada cambio
  const pending = Object.keys(changesBetween(baseRef.current, log)).length > 0;
  useEffect(() => {
    // En 'error' se encarga el reintento automático
    if (!pending || ['closed', 'saving', 'error'].includes(status.state)) return undefined;
    timerRef.current = setTimeout(save, AUTOSAVE_MS);
    return () => clearTimeout(timerRef.current);
  }, [log, pending, save, status.state]);

  // Aviso del navegador si se cierra con cambios sin guardar
  useEffect(() => {
    if (!pending) return undefined;
    const onBeforeUnload = (e) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [pending]);

  const set = useCallback((patch) => setLog((l) => ({ ...l, ...(typeof patch === 'function' ? patch(l) : patch) })), []);

  async function finish() {
    setLeaving(true);
    await save();
    setLeaving(false);
    if (!Object.keys(changesBetween(baseRef.current, logRef.current)).length || closedRef.current) {
      navigate(`/residentes/${id}`, { replace: true, state: { savedLog: true } });
    }
  }

  if (loadError === 'not-found') {
    return <EmptyState title="No encontrado" action={<BackLink id={id} />} />;
  }
  if (!resident || !info) {
    return loadError ? (
      <Alert>{loadError}</Alert>
    ) : (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  const mood = moodByValue(log.mood);
  const closed = status.state === 'closed';
  const invalid = hasInvalidVitals(log);
  const range = `${info.start.slice(11)}–${info.end.slice(11)}`;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <BackLink id={id} />

      <Card className="overflow-hidden">
        <header className="border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <MoodAvatar resident={resident} mood={log.mood} size="md" />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-x-1.5 text-xs font-medium text-brand-600">
                <ClipboardList className="size-3.5" /> Ficha del {dayAndDate(info.shift_date)} · {SHIFT_LABEL[info.shift]} ({range})
              </p>
              <h1 className="truncate text-lg font-semibold text-slate-900">
                {resident.first_name} {resident.last_name}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {locationLabel(resident)}
                {mood && ` · ${mood.emoji} ${mood.label}`}
              </p>
            </div>
            <span
              className={cn(
                'hidden shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ring-1 sm:inline-flex',
                closed
                  ? 'bg-slate-100 text-slate-600 ring-slate-200'
                  : info.open === false
                    ? 'bg-amber-50 text-amber-800 ring-amber-200'
                    : 'bg-accent-50 text-accent-800 ring-accent-200',
              )}
            >
              {closed
                ? 'Cerrada'
                : info.open === false
                  ? `Turno terminado · se cierra a las ${info.closes_at?.slice(11)}`
                  : `En curso · termina ${info.end.slice(11)}`}
            </span>
          </div>
          {info.contributors?.length > 0 && (
            <p className="mt-2 text-xs text-slate-500">Anotaron: {info.contributors.map((n) => shortName(n)).join(', ')}</p>
          )}
          <nav className="-mx-1 mt-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none]" aria-label="Secciones">
            {Object.entries(SECTIONS).map(([key, label]) => (
              <a
                key={key}
                href={`#${key}`}
                className="shrink-0 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        {closed && (
          <div className="flex items-start gap-2 border-b border-slate-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:px-6">
            <Lock className="mt-0.5 size-4 shrink-0" />
            {status.message || 'Esta ficha ya está cerrada. Para corregir algo, agrégale una nota desde la lista de fichas.'}
          </div>
        )}

        <fieldset disabled={closed} className={cn(closed && 'pointer-events-none opacity-60')}>
          <VitalsSection log={log} set={set} />
          <IntakeSection log={log} set={set} />
          <HygieneSection log={log} set={set} />
          <SkinSection log={log} set={set} />
          <WellbeingSection log={log} set={set} />
        </fieldset>

        <footer className="sticky bottom-0 z-10 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <SaveStatus status={status} pending={pending} invalid={invalid} />
            <Button onClick={finish} loading={leaving} className="ml-auto">
              <Check className="size-4" /> Listo
            </Button>
          </div>
        </footer>
      </Card>
    </div>
  );
}

function SaveStatus({ status, pending, invalid }) {
  if (status.state === 'closed') return <p className="text-xs text-slate-500">Solo lectura</p>;
  if (status.state === 'error') {
    return (
      <p className="flex items-center gap-1.5 text-xs font-medium text-red-700">
        <CloudOff className="size-4" /> Sin conexión: reintentando…
      </p>
    );
  }
  if (status.state === 'saving' || pending) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-slate-500">
        <Loader2 className="size-4 animate-spin" /> Guardando…
      </p>
    );
  }
  return (
    <p className="text-xs text-slate-500">
      {invalid ? (
        <span className="font-medium text-amber-700">Corrige los signos vitales fuera de rango (no se guardan así).</span>
      ) : status.state === 'saved' ? (
        <span className="flex items-center gap-1.5 text-accent-700">
          <Check className="size-4" /> Guardado {formatTime(status.at)} · se guarda solo
        </span>
      ) : (
        'Completa lo que corresponda: cada dato se guarda solo.'
      )}
    </p>
  );
}

function BackLink({ id }) {
  return (
    <Link
      to={`/residentes/${id}`}
      className="inline-flex h-10 items-center gap-2 rounded-lg px-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
    >
      <ArrowLeft className="size-4" /> Volver al residente
    </Link>
  );
}
