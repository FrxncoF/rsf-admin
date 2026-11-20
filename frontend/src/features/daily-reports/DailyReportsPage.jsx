import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { FileText, Lock, Pencil, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Form';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useAuth } from '@/features/auth/AuthContext';
import { useSites } from '@/features/sites/SiteContext';
import { cn } from '@/lib/utils';
import { AREAS, areaOf, dailyReportsApi } from './areas';
import { MentionText, MentionTextarea } from './MentionTextarea';

const ALL = 'ALL';
const MAX_LENGTH = 10000;

function formatDate(isoDate) {
  const text = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    new Date(`${isoDate}T12:00:00`),
  );
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const formatTime = (stamp) => new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit' }).format(new Date(stamp));

/**
 * Reportes Diarios: un resumen general del día por sede y área (Kinesiología, Terapia
 * Ocupacional, Enfermería, Encargada de turno). Solo Encargadas y Administradoras.
 * Quien lo escribe puede corregirlo el mismo día; después queda cerrado (salvo para Admin).
 */
export default function DailyReportsPage() {
  const { isAdmin } = useAuth();
  const { sites, siteId, currentSite } = useSites();
  const [date, setDate] = useState(''); // '' = hoy (lo decide el servidor, hora de Chile)
  const [area, setArea] = useState(ALL);
  const [state, setState] = useState({ data: [], date: null, today: null, loading: true, error: '' });
  const [dialog, setDialog] = useState(null); // { report } o { area } para uno nuevo

  const load = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    dailyReportsApi
      .list({ site_id: siteId ?? undefined, date: date || undefined })
      .then((res) => setState({ ...res, loading: false, error: '' }))
      .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
  }, [siteId, date]);

  useEffect(() => load(), [load]);

  const isToday = state.date && state.date === state.today;
  const visible = area === ALL ? state.data : state.data.filter((r) => r.area === area);
  const counts = useMemo(() => {
    const map = {};
    for (const r of state.data) map[r.area] = (map[r.area] ?? 0) + 1;
    return map;
  }, [state.data]);

  // Con una sede elegida y viendo hoy, se muestran las áreas que aún no tienen reporte
  const missing =
    isToday && siteId ? AREAS.filter((a) => !counts[a.value] && (area === ALL || area === a.value)) : [];

  const onSaved = (saved) => {
    setDialog(null);
    setState((s) => {
      const exists = s.data.some((r) => r.id === saved.id);
      return { ...s, data: exists ? s.data.map((r) => (r.id === saved.id ? saved : r)) : [...s.data, saved] };
    });
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Reportes Diarios</h1>
          <p className="mt-1 text-sm text-slate-500">
            {state.date ? formatDate(state.date) : '…'} · {currentSite ? `Sede ${currentSite.name}` : 'Todas las sedes'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            aria-label="Día"
            value={date || state.date || ''}
            max={state.today ?? undefined}
            onChange={(e) => setDate(e.target.value === state.today ? '' : e.target.value)}
            className="w-auto"
          />
          {isToday && (
            <Button onClick={() => setDialog({ area: area === ALL ? '' : area })}>
              <Plus className="size-4" /> Nuevo
            </Button>
          )}
        </div>
      </div>

      {/* Filtro por área */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <div className="flex gap-2">
          {[{ value: ALL, label: 'Todas' }, ...AREAS].map((a) => {
            const count = a.value === ALL ? state.data.length : (counts[a.value] ?? 0);
            return (
              <button
                key={a.value}
                type="button"
                onClick={() => setArea(a.value)}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  area === a.value
                    ? 'border-brand-500 bg-brand-50 text-brand-700 ring-2 ring-brand-500/20'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {a.label}
                <span className="text-xs tabular-nums text-slate-400">{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      <Alert>{state.error}</Alert>

      {state.loading && !state.date ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : visible.length === 0 && missing.length === 0 ? (
        <Card>
          <EmptyState
            icon={FileText}
            title="Sin reportes"
            description={
              isToday
                ? siteId
                  ? 'Todavía no hay reportes para hoy.'
                  : 'Todavía no hay reportes para hoy. Elige una sede arriba para ver qué áreas faltan.'
                : 'No se escribieron reportes ese día.'
            }
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              showSite={!siteId}
              isToday={isToday}
              onEdit={() => setDialog({ report })}
            />
          ))}
          {missing.map((a) => (
            <button
              key={a.value}
              type="button"
              onClick={() => setDialog({ area: a.value })}
              className="flex w-full items-center justify-between gap-3 rounded-xl border-2 border-dashed border-slate-200 px-4 py-4 text-left transition-colors hover:border-brand-300 hover:bg-brand-50/40"
            >
              <span className="flex items-center gap-2">
                <AreaBadge area={a.value} />
                <span className="text-sm text-slate-500">Sin reporte hoy</span>
              </span>
              <span className="flex items-center gap-1 text-sm font-medium text-brand-700">
                <Plus className="size-4" /> Escribir
              </span>
            </button>
          ))}
        </div>
      )}

      <ReportDialog
        open={Boolean(dialog)}
        report={dialog?.report}
        initialArea={dialog?.area ?? ''}
        sites={sites}
        siteId={siteId}
        isAdmin={isAdmin}
        onClose={() => setDialog(null)}
        onSaved={onSaved}
      />
    </div>
  );
}

function AreaBadge({ area }) {
  const a = areaOf(area);
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', a.className)}>
      {a.label}
    </span>
  );
}

function ReportCard({ report, showSite, isToday, onEdit }) {
  const edited = report.updated_by_name && new Date(report.updated_at) - new Date(report.created_at) > 60_000;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <AreaBadge area={report.area} />
          {showSite && <span className="text-xs font-medium text-slate-500">Sede {report.site_name}</span>}
        </div>
        {report.editable ? (
          <Button size="sm" variant="ghost" onClick={onEdit}>
            <Pencil className="size-4" /> Editar
          </Button>
        ) : (
          !isToday && (
            <span className="flex items-center gap-1 text-xs text-slate-400" title="Solo una administradora puede modificarlo">
              <Lock className="size-3.5" /> Cerrado
            </span>
          )
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-slate-800">
        <MentionText text={report.body} />
      </p>
      <p className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
        Escrito por <span className="font-medium text-slate-700">{report.author}</span> a las {formatTime(report.created_at)}
        {edited && (
          <>
            {' '}
            · editado por {report.updated_by_name} a las {formatTime(report.updated_at)}
          </>
        )}
      </p>
    </Card>
  );
}

function ReportDialog({ open, report, initialArea, sites, siteId, isAdmin, onClose, onSaved }) {
  const formId = useId();
  const isEdit = Boolean(report);
  const [values, setValues] = useState({ site_id: '', area: '', body: '' });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(
      report
        ? { site_id: String(report.site_id), area: report.area, body: report.body }
        : { site_id: siteId ? String(siteId) : sites.length === 1 ? String(sites[0].id) : '', area: initialArea, body: '' },
    );
    setErrors({});
    setServerError('');
  }, [open, report, initialArea, siteId, sites]);

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setServerError('');
    setErrors({});
    try {
      const saved = isEdit
        ? await dailyReportsApi.update(report.id, { area: values.area, body: values.body })
        : await dailyReportsApi.create({ site_id: values.site_id, area: values.area, body: values.body });
      onSaved(saved);
    } catch (err) {
      setServerError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  const siteName = sites.find((s) => String(s.id) === values.site_id)?.name;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      className="sm:max-w-2xl"
      title={isEdit ? 'Editar reporte' : 'Nuevo reporte del día'}
      description={
        isEdit && !isAdmin
          ? 'Puedes corregirlo hasta las 23:59 de hoy. Después queda cerrado.'
          : !isEdit
            ? 'Resumen general del día. Puedes corregirlo hasta las 23:59 de hoy.'
            : undefined
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={saving} disabled={!values.body.trim() || !values.area}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-4">
        <Alert>{serverError}</Alert>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Sede" htmlFor="dr_site" error={errors.site_id}>
            {isEdit || siteId ? (
              <Input id="dr_site" value={siteName ?? ''} disabled />
            ) : (
              <Select id="dr_site" required value={values.site_id} onChange={set('site_id')}>
                <option value="">Elige una sede</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Área" htmlFor="dr_area" error={errors.area}>
            <Select id="dr_area" required value={values.area} onChange={set('area')}>
              <option value="">Elige un área</option>
              {AREAS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Resumen del día" htmlFor="dr_body" error={errors.body} hint={`${values.body.length.toLocaleString('es-CL')} / 10.000`}>
          <MentionTextarea
            id="dr_body"
            rows={14}
            required
            maxLength={MAX_LENGTH}
            value={values.body}
            onChange={(body) => setValues((v) => ({ ...v, body }))}
            siteId={values.site_id ? Number(values.site_id) : null}
            placeholder="¿Cómo estuvo el día? Actividades, novedades, pendientes para el próximo turno… Escribe @ para nombrar a un residente."
          />
        </Field>
      </form>
    </Dialog>
  );
}
