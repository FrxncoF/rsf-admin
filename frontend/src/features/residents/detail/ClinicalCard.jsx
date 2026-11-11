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

const EMPTY_MED = { name: '', dose: '', schedule: '', instructions: '' };

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
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-900">
                      <span className="font-semibold">{m.name}</span> · {m.dose}
                    </p>
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
    setValues(med ? { ...EMPTY_MED, ...med, schedule: med.schedule ?? '', instructions: med.instructions ?? '' } : EMPTY_MED);
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
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    setServerError('');
    const payload = {
      name: values.name.trim(),
      dose: values.dose.trim(),
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
        <Field label="Horario / frecuencia (opcional)" htmlFor={`${formId}-schedule`} error={errors.schedule}>
          <Input
            id={`${formId}-schedule`}
            maxLength={80}
            placeholder="Ej: 08:00 y 20:00 · cada 12 h · SOS"
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
