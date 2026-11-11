import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ClipboardList, Save } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { residentsApi } from '@/features/residents/residentsApi';
import { locationLabel } from '@/lib/utils';
import { MoodAvatar } from './MoodAvatar';
import { moodByValue, SECTIONS } from './options';
import { EMPTY_LOG, formatDay, formatTime, hasInvalidVitals, isEmptyLog, toPayload } from './form';
import { dailyLogsApi } from './dailyLogsApi';
import { HygieneSection, IntakeSection, SkinSection, VitalsSection, WellbeingSection } from './sections';

/**
 * Nueva ficha diaria: todo en un solo contenedor, separado por secciones.
 * Se guarda una sola vez y no se puede modificar después (las correcciones van como notas).
 */
export default function DailyLogFormPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [resident, setResident] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [log, setLog] = useState(EMPTY_LOG);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    residentsApi
      .get(id)
      .then(setResident)
      .catch((err) => setLoadError(err.status === 404 ? 'not-found' : err.message));
  }, [id]);

  const set = useCallback((patch) => setLog((l) => ({ ...l, ...(typeof patch === 'function' ? patch(l) : patch) })), []);

  const empty = isEmptyLog(log);
  const invalid = hasInvalidVitals(log);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await dailyLogsApi.create({ resident_id: id, data: toPayload(log) });
      navigate(`/residentes/${id}`, { replace: true, state: { savedLog: true } });
    } catch (err) {
      setError(err.message);
      setConfirming(false);
    } finally {
      setSaving(false);
    }
  }

  if (loadError === 'not-found') {
    return <EmptyState title="Residente no encontrado" action={<BackLink id={id} />} />;
  }
  if (!resident) {
    return loadError ? (
      <Alert>{loadError}</Alert>
    ) : (
      <div className="flex justify-center py-20">
        <Spinner className="size-8" />
      </div>
    );
  }

  const mood = moodByValue(log.mood);
  const now = new Date().toISOString();

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <BackLink id={id} />

      <Card className="overflow-hidden">
        {/* Encabezado de la ficha */}
        <header className="border-b border-slate-200 bg-slate-50/70 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <MoodAvatar resident={resident} mood={log.mood} size="md" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 text-xs font-medium text-brand-600">
                <ClipboardList className="size-3.5" /> Nueva ficha · {formatDay(now)} · {formatTime(now)} hrs
              </p>
              <h1 className="truncate text-lg font-semibold text-slate-900">
                {resident.first_name} {resident.last_name}
              </h1>
              <p className="truncate text-xs text-slate-500">
                {locationLabel(resident)}
                {mood && ` · ${mood.emoji} ${mood.label}`}
              </p>
            </div>
          </div>
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

        <VitalsSection log={log} set={set} />
        <IntakeSection log={log} set={set} />
        <HygieneSection log={log} set={set} />
        <SkinSection log={log} set={set} />
        <WellbeingSection log={log} set={set} />

        {/* Pie fijo con la acción principal */}
        <footer className="sticky bottom-0 z-10 space-y-2 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:px-6">
          <Alert>{error}</Alert>
          <div className="flex items-center gap-3">
            <p className="hidden flex-1 text-xs text-slate-500 sm:block">
              {invalid
                ? 'Corrige los signos vitales fuera de rango.'
                : empty
                  ? 'Completa al menos un dato para guardar.'
                  : 'Completa solo lo que corresponda; lo demás puede quedar en blanco.'}
            </p>
            <Button variant="outline" onClick={() => navigate(`/residentes/${id}`)} className="flex-1 sm:flex-none">
              Cancelar
            </Button>
            <Button onClick={() => setConfirming(true)} disabled={empty || invalid} className="flex-1 sm:flex-none">
              <Save className="size-4" /> Guardar ficha
            </Button>
          </div>
        </footer>
      </Card>

      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={save}
        loading={saving}
        title="Guardar ficha"
        confirmLabel="Sí, guardar"
        description="Una vez guardada, la ficha no se puede modificar. Si algo queda mal, podrás agregarle una nota."
      />
    </div>
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
