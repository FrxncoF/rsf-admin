import { useEffect, useId, useState } from 'react';
import { Ambulance, Building, HeartHandshake, Hospital, Pencil, Pill, Plus, Stethoscope, Trash2, X } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog';
import { Field, Input } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Feedback';
import { residentsApi } from '../residentsApi';
import { COGNITIVE_LEVELS, DEPENDENCY_LEVELS, PRESSURE_RISKS, healthLabel, optionOf } from '../constants';
import { catalogLabel, useAppConfig } from '@/features/app-config/AppConfigContext';
import { COMMON_TIMES, MedicationTimes, TimeChip } from '@/features/medications/time';

const EMPTY_MED = { name: '', dose: '', times: [], is_sos: false, schedule: '', instructions: '' };

/**
 * Patologías y medicamentos. Ambos roles los ven; solo ADMIN agrega, edita o quita.
 * Cada cambio devuelve el residente actualizado (`onChange`).
 */
export default function ClinicalCard({ resident, canEdit, onChange }) {
  const [condition, setCondition] = useState('');
  const [addingCondition, setAddingCondition] = useState(false);
  const [medDialog, setMedDialog] = useState({ open: false, med: null });
  const [toDelete, setToDelete] = useState(null); // { kind, item }
  const [busy, setBusy] = useState(false);
  const { catalogs } = useAppConfig();
  const [error, setError] = useState('');

  const run = async (fn) => {
    setBusy(true);
    setError('');
    try {
      onChange(await fn());
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  async function addCondition(e) {
    e.preventDefault();
    if (!condition.trim()) return;
    if (await run(() => residentsApi.addCondition(resident.id, condition.trim()))) setCondition('');
  }

  async function confirmDelete() {
    const { kind, item } = toDelete;
    await run(() =>
      kind === 'condition' ? residentsApi.removeCondition(resident.id, item.id) : residentsApi.removeMedication(resident.id, item.id),
    );
    setToDelete(null);
  }

  const { conditions = [], medications = [] } = resident;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Stethoscope className="size-5 text-brand-600" /> Salud
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert>{error}</Alert>

        {/* Cobertura */}
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Item icon={HeartHandshake} label="Previsión" value={healthLabel(resident, catalogs.isapres)} />
          <Item icon={Ambulance} label="Ambulancia" value={catalogLabel(catalogs.ambulances, resident.ambulance)} />
          <Item
            icon={Building}
            label="Inscrito en CESFAM"
            value={resident.has_cesfam == null ? null : resident.has_cesfam ? 'Sí' : 'No'}
          />
          <Item icon={Hospital} label="Lugar de atención" value={resident.care_place} />
        </dl>

        {/* Escalas de valoración */}
        <section className="space-y-2.5">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valoración</h4>
          <dl className="grid gap-3 sm:grid-cols-3">
            <Scale label="Katz · dependencia" option={optionOf(DEPENDENCY_LEVELS, resident.dependency_level)} />
            <Scale label="Pfeiffer · cognitivo" option={optionOf(COGNITIVE_LEVELS, resident.cognitive_level)} />
            <Scale label="Norton · úlceras por presión" option={optionOf(PRESSURE_RISKS, resident.pressure_risk)} />
          </dl>
        </section>

        {/* Patologías */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patologías</h4>
            {canEdit && !addingCondition && (
              <Button size="sm" variant="ghost" onClick={() => setAddingCondition(true)}>
                <Plus className="size-4" /> Agregar
              </Button>
            )}
          </div>
          {conditions.length === 0 && !addingCondition && <p className="text-sm text-slate-400">Sin patologías registradas.</p>}
          {conditions.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {conditions.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1.5 text-sm font-medium text-brand-800 ring-1 ring-brand-200"
                >
                  {c.name}
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Quitar ${c.name}`}
                      onClick={() => setToDelete({ kind: 'condition', item: c })}
                      className="rounded-full p-0.5 text-brand-400 hover:bg-brand-100 hover:text-red-600"
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {addingCondition && (
            <form onSubmit={addCondition} className="flex gap-2">
              <Input
                autoFocus
                maxLength={120}
                placeholder="Ej: Hipertensión arterial"
                value={condition}
                onChange={(e) => setCondition(e.target.value)}
              />
              <Button type="submit" loading={busy} disabled={!condition.trim()}>
                Agregar
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Cerrar"
                className="h-10 w-10"
                onClick={() => {
                  setAddingCondition(false);
                  setCondition('');
                }}
              >
                <X className="size-4" />
              </Button>
            </form>
          )}
        </section>

        {/* Medicamentos */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Medicamentos</h4>
            {canEdit && (
              <Button size="sm" variant="ghost" onClick={() => setMedDialog({ open: true, med: null })}>
                <Plus className="size-4" /> Agregar
              </Button>
            )}
          </div>
          {medications.length === 0 ? (
            <p className="text-sm text-slate-400">Sin medicamentos registrados.</p>
          ) : (
            <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {medications.map((m) => (
                <li key={m.id} className="flex items-start gap-3 px-3 py-2.5">
                  <Pill className="mt-0.5 size-4 shrink-0 text-accent-600" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-sm text-slate-900">
                      <span className="font-semibold">{m.name}</span> · {m.dose}
                    </p>
                    <MedicationTimes med={m} />
                    {(m.schedule || m.instructions) && (
                      <p className="text-xs text-slate-500">{[m.schedule, m.instructions].filter(Boolean).join(' · ')}</p>
                    )}
                  </div>
                  {canEdit && (
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" aria-label="Editar" onClick={() => setMedDialog({ open: true, med: m })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Quitar"
                        className="hover:bg-red-50 hover:text-red-600"
                        onClick={() => setToDelete({ kind: 'medication', item: m })}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </CardContent>

      {canEdit && (
        <MedicationDialog
          open={medDialog.open}
          med={medDialog.med}
          residentId={resident.id}
          onClose={() => setMedDialog((d) => ({ ...d, open: false }))}
          onSaved={(saved) => {
            onChange(saved);
            setMedDialog((d) => ({ ...d, open: false }));
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        onConfirm={confirmDelete}
        loading={busy}
        destructive
        title={toDelete?.kind === 'condition' ? 'Quitar patología' : 'Quitar medicamento'}
        confirmLabel="Quitar"
        description={toDelete && `Se quitará "${toDelete.item.name}" de la ficha del residente.`}
      />
    </Card>
  );
}

function MedicationDialog({ open, med, residentId, onClose, onSaved }) {
  const formId = useId();
  const [values, setValues] = useState(EMPTY_MED);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(
      med
        ? { ...EMPTY_MED, ...med, times: med.times ?? [], schedule: med.schedule ?? '', instructions: med.instructions ?? '' }
        : EMPTY_MED,
    );
    setErrors({});
    setServerError('');
  }, [open, med]);

  const set = (key) => (e) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const clientErrors = {};
    if (!values.name.trim()) clientErrors.name = 'Ingresa el medicamento';
    if (!values.dose.trim()) clientErrors.dose = 'Ingresa la dosis';
    if (!values.is_sos && values.times.length === 0) clientErrors.times = 'Agrega al menos una hora, o márcalo como SOS';
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    setServerError('');
    const payload = {
      name: values.name.trim(),
      dose: values.dose.trim(),
      times: values.times,
      is_sos: values.is_sos,
      schedule: values.schedule.trim() || null,
      instructions: values.instructions.trim() || null,
    };
    try {
      onSaved(
        med ? await residentsApi.updateMedication(residentId, med.id, payload) : await residentsApi.addMedication(residentId, payload),
      );
    } catch (err) {
      setServerError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      title={med ? 'Editar medicamento' : 'Agregar medicamento'}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Medicamento" htmlFor={`${formId}-name`} error={errors.name}>
            <Input id={`${formId}-name`} maxLength={120} placeholder="Ej: Losartán" value={values.name} onChange={set('name')} aria-invalid={!!errors.name} />
          </Field>
          <Field label="Dosis" htmlFor={`${formId}-dose`} error={errors.dose}>
            <Input id={`${formId}-dose`} maxLength={60} placeholder="Ej: 50 mg" value={values.dose} onChange={set('dose')} aria-invalid={!!errors.dose} />
          </Field>
        </div>
        <TimesField
          id={`${formId}-times`}
          times={values.times}
          isSos={values.is_sos}
          error={errors.times}
          onChange={(patch) => {
            setValues((v) => ({ ...v, ...patch }));
            setErrors((errs) => ({ ...errs, times: undefined }));
          }}
        />
        <Field label="Nota de horario (opcional)" htmlFor={`${formId}-schedule`} error={errors.schedule}>
          <Input
            id={`${formId}-schedule`}
            maxLength={80}
            placeholder="Ej: con desayuno · en ayunas"
            value={values.schedule}
            onChange={set('schedule')}
          />
        </Field>
        <Field label="Indicaciones (opcional)" htmlFor={`${formId}-instructions`} error={errors.instructions}>
          <Input
            id={`${formId}-instructions`}
            maxLength={200}
            placeholder="Ej: con comida · si hay dolor"
            value={values.instructions}
            onChange={set('instructions')}
          />
        </Field>
      </form>
    </Dialog>
  );
}

/** Horas del medicamento (24 h) con atajos, más la marca SOS. */
function TimesField({ id, times, isSos, error, onChange }) {
  const [draft, setDraft] = useState('');
  const add = (t) => t && !times.includes(t) && onChange({ times: [...times, t].sort() });
  const remove = (t) => onChange({ times: times.filter((x) => x !== t) });

  return (
    <div className="space-y-2.5 rounded-xl border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium text-slate-700">
          {isSos ? 'Horas posibles (opcional)' : 'Horario (formato 24 h)'}
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-700">
          <input
            type="checkbox"
            checked={isSos}
            onChange={(e) => onChange({ is_sos: e.target.checked })}
            className="size-4 rounded border-slate-300 text-red-600 focus:ring-red-500"
          />
          SOS (solo si se necesita)
        </label>
      </div>

      {times.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {times.map((t) => (
            <li key={t}>
              <TimeChip time={t} muted={isSos} className="py-1 pl-2 pr-1 text-sm">
                <button type="button" aria-label={`Quitar ${t}`} onClick={() => remove(t)} className="rounded p-0.5 hover:bg-black/5">
                  <X className="size-3.5" />
                </button>
              </TimeChip>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {COMMON_TIMES.filter((t) => !times.includes(t)).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => add(t)}
            className="rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs font-medium tabular-nums text-slate-600 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
          >
            + {t}
          </button>
        ))}
        <div className="flex items-center gap-1.5">
          <Input
            id={id}
            type="time"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 w-28 text-sm"
            aria-invalid={!!error}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!draft}
            onClick={() => {
              add(draft);
              setDraft('');
            }}
          >
            Agregar
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function Item({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-brand-600" />
      <div className="min-w-0">
        <dt className="text-xs text-slate-500">{label}</dt>
        <dd className="break-words font-medium text-slate-900">{value || '—'}</dd>
      </div>
    </div>
  );
}

function Scale({ label, option }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2.5">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1">{option ? <Badge variant={option.badge}>{option.label}</Badge> : <span className="text-sm text-slate-400">Sin evaluar</span>}</dd>
    </div>
  );
}
