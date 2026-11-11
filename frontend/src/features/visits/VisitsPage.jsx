import { useCallback, useEffect, useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { DoorOpen, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field, Input, Select } from '@/components/ui/Form';
import { Alert, EmptyState, Spinner } from '@/components/ui/Feedback';
import { useAuth } from '@/features/auth/AuthContext';
import { useSites } from '@/features/sites/SiteContext';
import { residentsApi } from '@/features/residents/residentsApi';
import { ResidentAvatar } from '@/features/residents/ResidentAvatar';
import { useDebouncedValue } from '@/lib/hooks';
import { cn, roomLabel } from '@/lib/utils';
import { formatDay, formatTime } from '@/features/daily-log/form';
import { visitsApi } from './visitsApi';

const PAGE_SIZE = 30;
const OTHER = 'other';
const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA');

function dayTitle(iso) {
  const key = dayKey(iso);
  if (key === dayKey(new Date())) return 'Hoy';
  if (key === dayKey(new Date(Date.now() + 86_400_000))) return 'Mañana';
  if (key === dayKey(new Date(Date.now() - 86_400_000))) return 'Ayer';
  return formatDay(iso);
}

const pad = (n) => String(n).padStart(2, '0');
// Horario de visitas: 09:00 a 20:00, en bloques de 30 minutos (formato 24 h)
const FIRST_SLOT = '09:00';
const LAST_SLOT = '20:00';
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => `${pad(Math.floor(i / 2))}:${i % 2 ? '30' : '00'}`).filter(
  (t) => t >= FIRST_SLOT && t <= LAST_SLOT,
);
const localDate = (d = new Date()) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD local

/** Fecha de hoy y el bloque de 30 min en curso (ej. 15:47 → 15:30) */
function nowSlot() {
  const d = new Date();
  return { date: localDate(d), time: `${pad(d.getHours())}:${d.getMinutes() >= 30 ? '30' : '00'}` };
}

// Se pueden agendar visitas hasta 30 días adelante, o registrar las de hasta un año atrás
const MAX_DAYS_AHEAD = 30;
const addDays = (days) => localDate(new Date(Date.now() + days * 86_400_000));

/** Valor inicial: el bloque actual dentro del horario (antes de las 9 → hoy 09:00; después de las 20 → mañana 09:00). */
function defaultSlot() {
  const now = nowSlot();
  if (now.time < FIRST_SLOT) return { date: now.date, time: FIRST_SLOT };
  if (now.time > LAST_SLOT) return { date: addDays(1), time: FIRST_SLOT };
  return now;
}

/** Visitas a los residentes: historial simple, filtrado por la sede elegida arriba. */
export default function VisitsPage() {
  const { isAdmin } = useAuth();
  const { siteId, currentSite } = useSites();
  const [state, setState] = useState({ items: [], meta: null, loading: true, error: '' });
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(
    (page = 1) => {
      setState((s) => ({ ...s, loading: true }));
      visitsApi
        .list({ site_id: siteId ?? undefined, page, pageSize: PAGE_SIZE })
        .then(({ data, meta }) =>
          setState((s) => ({ items: page === 1 ? data : [...s.items, ...data], meta, loading: false, error: '' })),
        )
        .catch((err) => setState((s) => ({ ...s, loading: false, error: err.message })));
    },
    [siteId],
  );

  useEffect(() => load(1), [load]);

  async function confirmDelete() {
    setDeleting(true);
    try {
      await visitsApi.remove(toDelete.id);
      setState((s) => ({ ...s, items: s.items.filter((v) => v.id !== toDelete.id) }));
      setToDelete(null);
    } catch (err) {
      setState((s) => ({ ...s, error: err.message }));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  const { items, meta, loading, error } = state;
  const groups = [];
  for (const visit of items) {
    const key = dayKey(visit.visit_at);
    if (groups.at(-1)?.key !== key) groups.push({ key, title: dayTitle(visit.visit_at), visits: [] });
    groups.at(-1).visits.push(visit);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Visitas</h1>
          <p className="mt-1 text-sm text-slate-500">{currentSite ? `Sede ${currentSite.name}` : 'Todas las sedes'}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Plus className="size-4" /> Registrar visita
        </Button>
      </div>

      <Alert>{error}</Alert>

      {loading && items.length === 0 ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : items.length === 0 ? (
        <Card>
          <EmptyState icon={DoorOpen} title="Aún no hay visitas" description="Registra la primera con el botón de arriba." />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.key}>
              <h2 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.title}</h2>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {g.visits.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-3 py-2.5">
                    <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-brand-700">{formatTime(v.visit_at)}</span>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="truncate text-slate-900">
                        <span className="font-medium">{v.visitor_name}</span>
                        {v.relationship && <span className="text-slate-500"> ({v.relationship})</span>}
                        {new Date(v.visit_at) > new Date() && (
                          <span className="ml-2 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-brand-200">
                            Agendada
                          </span>
                        )}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {new Date(v.visit_at) > new Date() ? 'visitará a' : 'visitó a'}{' '}
                        <Link to={`/residentes/${v.resident_id}`} className="font-medium text-brand-700 hover:underline">
                          {v.first_name.split(' ')[0]} {v.last_name.split(' ')[0]}
                        </Link>{' '}
                        · {v.site_name} · {roomLabel(v)}
                      </p>
                      <p className="truncate text-xs text-slate-400">Registró: {v.author}</p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Eliminar visita"
                        className="hover:bg-red-50 hover:text-red-600"
                        onClick={() => setToDelete(v)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {meta && meta.page < meta.totalPages && (
            <Button variant="outline" className="w-full" loading={loading} onClick={() => load(meta.page + 1)}>
              Ver visitas anteriores
            </Button>
          )}
        </div>
      )}

      <VisitFormDialog
        open={creating}
        siteId={siteId}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          load(1);
        }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={deleting}
        destructive
        title="Eliminar visita"
        confirmLabel="Eliminar"
        description={toDelete && `Se eliminará la visita de ${toDelete.visitor_name} (${formatDay(toDelete.visit_at)} ${formatTime(toDelete.visit_at)}).`}
      />
    </div>
  );
}

function VisitFormDialog({ open, siteId, onClose, onSaved }) {
  const formId = useId();
  const [values, setValues] = useState({
    resident: null, // residente elegido; la sede de la visita es la suya
    visitor: '',
    visitor_name: '',
    relationship: '',
    date: '',
    time: '',
  });
  const [guardians, setGuardians] = useState({ list: [], loading: false });
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues({ resident: null, visitor: '', visitor_name: '', relationship: '', ...defaultSlot() });
    setGuardians({ list: [], loading: false });
    setErrors({});
    setServerError('');
  }, [open]);

  // Apoderados del residente elegido
  const residentId = values.resident?.id;
  useEffect(() => {
    if (!residentId) return;
    let alive = true;
    setGuardians({ list: [], loading: true });
    residentsApi
      .get(residentId)
      .then((r) => alive && setGuardians({ list: r.guardians ?? [], loading: false }))
      .catch(() => alive && setGuardians({ list: [], loading: false }));
    return () => {
      alive = false;
    };
  }, [residentId]);

  const set = (patch) => {
    setValues((v) => ({ ...v, ...patch }));
    setErrors((errs) => ({ ...errs, ...Object.fromEntries(Object.keys(patch).map((k) => [k, undefined])) }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const clientErrors = {};
    if (!values.resident) clientErrors.resident_id = 'Busca y selecciona el residente';
    if (!values.visitor) clientErrors.visitor = 'Indica quién visita';
    if (values.visitor === OTHER && !values.visitor_name.trim()) clientErrors.visitor_name = 'Escribe el nombre';
    if (!values.date || !values.time) clientErrors.visit_at = 'Indica la fecha y la hora';
    else if (values.date > addDays(MAX_DAYS_AHEAD)) clientErrors.visit_at = `Se puede agendar hasta ${MAX_DAYS_AHEAD} días adelante`;
    else if (values.time < FIRST_SLOT || values.time > LAST_SLOT) clientErrors.visit_at = 'El horario de visitas es de 09:00 a 20:00';
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    setServerError('');
    try {
      await visitsApi.create({
        site_id: values.resident.site_id,
        resident_id: values.resident.id,
        ...(values.visitor === OTHER
          ? { visitor_name: values.visitor_name.trim(), relationship: values.relationship.trim() || null }
          : { guardian_id: values.visitor }),
        visit_at: new Date(`${values.date}T${values.time}`).toISOString(),
      });
      onSaved();
    } catch (err) {
      setServerError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  const maxDate = addDays(MAX_DAYS_AHEAD);

  const visitorOptions = [
    ...guardians.list.map((g) => ({ value: g.id, label: g.full_name, hint: g.relationship })),
    { value: OTHER, label: 'Otra persona', hint: 'Familiar o amigo' },
  ];

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      title="Registrar visita"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            Guardar
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
        <Alert>{serverError}</Alert>

        <Field label="Residente" htmlFor={`${formId}-resident`} error={errors.resident_id}>
          {values.resident ? (
            <div className="flex items-center gap-3 rounded-lg border-2 border-brand-500 bg-brand-50 px-3 py-2.5">
              <ResidentAvatar resident={values.resident} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {values.resident.first_name} {values.resident.last_name}
                </p>
                <p className="truncate text-xs text-slate-600">
                  Sede <span className="font-medium">{values.resident.site_name}</span> · {roomLabel(values.resident)}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => set({ resident: null, visitor: '' })}>
                Cambiar
              </Button>
            </div>
          ) : (
            <ResidentSearch
              inputId={`${formId}-resident`}
              siteId={siteId}
              invalid={!!errors.resident_id}
              onSelect={(resident) => set({ resident, resident_id: undefined, visitor: '' })}
            />
          )}
        </Field>

        {values.resident && (
          <Field label="¿Quién visita?" error={errors.visitor}>
            {guardians.loading ? (
              <Spinner className="size-5" />
            ) : (
              <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
                {visitorOptions.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    role="radio"
                    aria-checked={values.visitor === o.value}
                    onClick={() => set({ visitor: o.value })}
                    className={cn(
                      'flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-left text-sm transition',
                      values.visitor === o.value
                        ? 'border-2 border-brand-500 bg-brand-50 text-brand-900'
                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {o.value === OTHER ? <Plus className="size-4 shrink-0" /> : <UserRound className="size-4 shrink-0" />}
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{o.label}</span>
                      {o.hint && <span className="block text-xs text-slate-500">{o.hint}</span>}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </Field>
        )}

        {values.visitor === OTHER && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor={`${formId}-name`} error={errors.visitor_name}>
              <Input
                id={`${formId}-name`}
                maxLength={120}
                value={values.visitor_name}
                onChange={(e) => set({ visitor_name: e.target.value })}
                aria-invalid={!!errors.visitor_name}
              />
            </Field>
            <Field label="Relación (opcional)" htmlFor={`${formId}-rel`} error={errors.relationship}>
              <Input
                id={`${formId}-rel`}
                maxLength={40}
                placeholder="Ej: Nieta, Amiga"
                value={values.relationship}
                onChange={(e) => set({ relationship: e.target.value })}
              />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <Field label="Fecha" htmlFor={`${formId}-date`} error={errors.visit_at} hint={`Hasta ${MAX_DAYS_AHEAD} días adelante`}>
            <Input
              id={`${formId}-date`}
              type="date"
              max={maxDate}
              value={values.date}
              onChange={(e) => set({ date: e.target.value, visit_at: undefined })}
              aria-invalid={!!errors.visit_at}
            />
          </Field>
          <Field label="Hora" htmlFor={`${formId}-time`} hint="Visitas de 09:00 a 20:00">
            <Select
              id={`${formId}-time`}
              value={values.time}
              onChange={(e) => set({ time: e.target.value, visit_at: undefined })}
            >
              {TIME_SLOTS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </form>
    </Dialog>
  );
}

/** Buscador de residentes activos por nombre, habitación o RUT (el RUT solo para ADMIN). */
function ResidentSearch({ siteId, onSelect, invalid, inputId }) {
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search).trim();
  const [state, setState] = useState({ results: [], loading: false });

  useEffect(() => {
    if (!debounced) return setState({ results: [], loading: false });
    const controller = new AbortController();
    setState((s) => ({ ...s, loading: true }));
    residentsApi
      .list(
        { search: debounced, site_id: siteId ?? undefined, status: 'active', sort: 'name', pageSize: 8 },
        { signal: controller.signal },
      )
      .then(({ data }) => setState({ results: data, loading: false }))
      .catch((err) => err.name !== 'AbortError' && setState({ results: [], loading: false }));
    return () => controller.abort();
  }, [debounced, siteId]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
        <Input
          id={inputId}
          type="search"
          autoFocus
          autoComplete="off"
          placeholder={isAdmin ? 'Buscar por nombre, habitación o RUT' : 'Buscar por nombre o habitación'}
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-invalid={invalid || undefined}
        />
        {state.loading && <Spinner className="absolute right-3 top-1/2 size-4 -translate-y-1/2" />}
      </div>

      {debounced && !state.loading && (
        <ul className="max-h-60 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200 bg-white">
          {state.results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-slate-500">Sin coincidencias.</li>
          ) : (
            state.results.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => onSelect(r)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-brand-50"
                >
                  <ResidentAvatar resident={r} size="sm" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">
                      {r.first_name} {r.last_name}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {r.site_name} · {roomLabel(r)}
                    </span>
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
