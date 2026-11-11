import { useEffect, useId, useState } from 'react';
import { ImagePlus, Search, Trash2, UserPlus, UserRound, X } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, Select } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Feedback';
import { formatRut, isValidRut } from '@/lib/rut';
import { formatPhone } from '@/lib/phone';
import { formatClp, parseUfInput, useUf } from '@/lib/money';
import { useSites } from '@/features/sites/SiteContext';
import { GuardianPicker } from '@/features/guardians/GuardianPicker';
import {
  EMPTY_GUARDIAN,
  GuardianFields,
  toGuardianPayload,
  validateGuardian,
} from '@/features/guardians/GuardianFields';
import { residentsApi } from '../residentsApi';
import { ResidentAvatar } from '../ResidentAvatar';
import {
  COGNITIVE_LEVELS,
  DEPENDENCY_LEVELS,
  HEALTH_SYSTEMS,
  PAYMENT_DAYS,
  PRESSURE_RISKS,
  RELATIONSHIP_PENDING,
  ROOM_PENDING,
} from '../constants';
import { catalogOptions, useAppConfig } from '@/features/app-config/AppConfigContext';

export const MAX_GUARDIANS = 2;
const RELATIONSHIPS = ['Hijo', 'Hija', 'Nieto', 'Nieta', 'Cónyuge', 'Hermano', 'Hermana', 'Sobrino', 'Sobrina', 'Nuera', 'Yerno', 'Tutor legal', 'Otro'];
const today = () => new Date().toISOString().slice(0, 10);

/**
 * Cada apoderado del formulario es un vínculo:
 *  · mode 'existing' → apoderado ya registrado (`selected`), se envía `guardian_id`
 *  · mode 'new'      → se crea en la misma operación con los datos de `data`
 */
const EMPTY_LINK = { mode: 'existing', selected: null, data: EMPTY_GUARDIAN, relationship: '' };

const EMPTY = {
  first_name: '',
  last_name: '',
  rut: '',
  birth_date: '',
  site_id: '',
  room: '',
  bed: '',
  admission_date: '',
  dependency_level: '',
  cognitive_level: '',
  pressure_risk: '',
  monthly_fee_uf: '',
  payment_due_day: '',
  ambulance: '',
  has_cesfam: '', // 'yes' | 'no'
  care_place: '',
  health_system: '',
  isapre: '',
  is_active: true,
  guardians: [EMPTY_LINK],
};

function validate(values) {
  const errors = {};
  if (!values.first_name.trim()) errors.first_name = 'Ingresa el nombre';
  if (!values.last_name.trim()) errors.last_name = 'Ingresa el apellido';
  if (!isValidRut(values.rut)) errors.rut = 'RUT inválido';
  if (!values.birth_date) errors.birth_date = 'Ingresa la fecha de nacimiento';
  else if (values.birth_date > today()) errors.birth_date = 'La fecha no puede ser futura';
  if (!values.site_id) errors.site_id = 'Selecciona la sede';
  if (!values.room.trim()) errors.room = 'Ingresa la habitación';

  if (!values.admission_date) errors.admission_date = 'Ingresa la fecha de ingreso';
  else if (values.admission_date > today()) errors.admission_date = 'La fecha no puede ser futura';
  else if (values.birth_date && values.admission_date < values.birth_date) errors.admission_date = 'No puede ser antes del nacimiento';
  if (!values.dependency_level) errors.dependency_level = 'Selecciona el índice de Katz';
  if (!values.cognitive_level) errors.cognitive_level = 'Selecciona el índice de Pfeiffer';
  if (!values.pressure_risk) errors.pressure_risk = 'Selecciona la escala de Norton';

  const fee = parseUfInput(values.monthly_fee_uf);
  if (String(values.monthly_fee_uf).trim() === '') errors.monthly_fee_uf = 'Ingresa la mensualidad';
  else if (!/^\d{1,5}([.,]\d{1,2})?$/.test(String(values.monthly_fee_uf).trim()) || !(fee > 0)) {
    errors.monthly_fee_uf = 'Monto inválido (ej: 28,5)';
  }
  if (!values.payment_due_day) errors.payment_due_day = 'Indica el día';
  if (!values.ambulance) errors.ambulance = 'Selecciona la ambulancia';
  if (!values.has_cesfam) errors.has_cesfam = 'Indica si está inscrito';
  if (!values.health_system) errors.health_system = 'Selecciona la previsión';
  else if (values.health_system === 'ISAPRE' && !values.isapre) errors.isapre = 'Selecciona la isapre';

  if (values.guardians.length < 1) errors.guardians = 'El residente debe tener al menos un apoderado';
  values.guardians.forEach((link, i) => {
    if (!link.relationship.trim()) errors[`guardians.${i}.relationship`] = 'Indica el parentesco';
    if (link.mode === 'existing' && !link.selected) errors[`guardians.${i}.guardian_id`] = 'Busca y selecciona un apoderado, o crea uno nuevo';
    if (link.mode === 'new') {
      for (const [field, message] of Object.entries(validateGuardian(link.data))) {
        errors[`guardians.${i}.guardian.${field}`] = message;
      }
    }
  });
  const [a, b] = values.guardians;
  if (a?.selected && b?.selected && a.selected.id === b.selected.id) errors['guardians.1.guardian_id'] = 'Ya está asignado como primer apoderado';
  if (a?.mode === 'new' && b?.mode === 'new' && a.data.rut && a.data.rut === b.data.rut) {
    errors['guardians.1.guardian.rut'] = 'No puede repetir el RUT del primer apoderado';
  }
  return errors;
}

const toFormLink = (g) => ({
  ...EMPTY_LINK,
  selected: g,
  relationship: !g.relationship || g.relationship === RELATIONSHIP_PENDING ? '' : g.relationship,
});

const toPayloadLink = (link) =>
  link.mode === 'existing'
    ? { guardian_id: link.selected.id, relationship: link.relationship.trim() }
    : { guardian: toGuardianPayload(link.data), relationship: link.relationship.trim() };

export default function ResidentFormDialog({ open, resident, onClose, onSaved }) {
  const isEdit = Boolean(resident);
  const formId = useId();
  const { sites, siteId: currentSiteId } = useSites();
  const { uf } = useUf();
  const { catalogs } = useAppConfig();
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setValues(
      resident
        ? {
            ...EMPTY,
            ...resident,
            rut: formatRut(resident.rut),
            room: resident.room === ROOM_PENDING ? '' : resident.room,
            bed: resident.bed ?? '',
            admission_date: resident.admission_date ?? '',
            dependency_level: resident.dependency_level ?? '',
            cognitive_level: resident.cognitive_level ?? '',
            pressure_risk: resident.pressure_risk ?? '',
            monthly_fee_uf: resident.monthly_fee_uf != null ? String(resident.monthly_fee_uf).replace('.', ',') : '',
            payment_due_day: resident.payment_due_day ?? '',
            ambulance: resident.ambulance ?? '',
            has_cesfam: resident.has_cesfam == null ? '' : resident.has_cesfam ? 'yes' : 'no',
            care_place: resident.care_place ?? '',
            health_system: resident.health_system ?? '',
            isapre: resident.isapre ?? '',
            guardians: resident.guardians?.length ? resident.guardians.map(toFormLink) : [EMPTY_LINK],
          }
        : { ...EMPTY, site_id: currentSiteId ?? '' },
    );
    setErrors({});
    setServerError('');
    setPhotoFile(null);
    setRemovePhoto(false);
  }, [open, resident, currentSiteId]);

  useEffect(() => {
    if (!photoFile) return setPhotoPreview(null);
    const url = URL.createObjectURL(photoFile);
    setPhotoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photoFile]);

  const set = (key, transform = (v) => v) => (e) => {
    const raw = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setValues((v) => ({ ...v, [key]: transform(raw) }));
    setErrors((errs) => ({ ...errs, [key]: undefined }));
  };

  const updateLink = (index, patch, clearKeys = []) => {
    setValues((v) => ({ ...v, guardians: v.guardians.map((g, i) => (i === index ? { ...g, ...patch } : g)) }));
    setErrors((errs) => {
      const next = { ...errs, guardians: undefined };
      for (const key of clearKeys) next[`guardians.${index}.${key}`] = undefined;
      return next;
    });
  };

  const addGuardian = () =>
    setValues((v) => (v.guardians.length >= MAX_GUARDIANS ? v : { ...v, guardians: [...v.guardians, EMPTY_LINK] }));

  const removeGuardian = (index) => {
    setValues((v) => (v.guardians.length <= 1 ? v : { ...v, guardians: v.guardians.filter((_, i) => i !== index) }));
    // Los errores por índice dejan de corresponder: se limpian y se recalculan al guardar
    setErrors((errs) => Object.fromEntries(Object.entries(errs).filter(([k]) => !k.startsWith('guardians'))));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    const clientErrors = validate(values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length) return;

    setSaving(true);
    setServerError('');
    try {
      const payload = {
        first_name: values.first_name.trim(),
        last_name: values.last_name.trim(),
        rut: values.rut,
        birth_date: values.birth_date,
        site_id: Number(values.site_id),
        room: values.room.trim(),
        bed: values.bed.trim() || null,
        admission_date: values.admission_date,
        dependency_level: values.dependency_level,
        cognitive_level: values.cognitive_level,
        pressure_risk: values.pressure_risk,
        monthly_fee_uf: String(values.monthly_fee_uf).trim(),
        payment_due_day: Number(values.payment_due_day),
        ambulance: values.ambulance,
        has_cesfam: values.has_cesfam === 'yes',
        care_place: values.care_place.trim() || null,
        health_system: values.health_system,
        isapre: values.health_system === 'ISAPRE' ? values.isapre : null,
        is_active: values.is_active,
        guardians: values.guardians.map(toPayloadLink),
      };
      let saved = isEdit ? await residentsApi.update(resident.id, payload) : await residentsApi.create(payload);

      // La foto va en una segunda llamada: si falla, los datos ya quedaron guardados
      let photoError;
      try {
        if (photoFile) saved = await residentsApi.uploadPhoto(saved.id, photoFile);
        else if (removePhoto && saved.has_photo) saved = await residentsApi.removePhoto(saved.id);
      } catch (err) {
        photoError = err.message;
      }

      onSaved(saved, { photoError });
    } catch (err) {
      setServerError(err.message);
      if (err.details) setErrors(err.details);
    } finally {
      setSaving(false);
    }
  }

  const currentHasPhoto = isEdit && resident.has_photo && !removePhoto;
  const fee = parseUfInput(values.monthly_fee_uf);

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      className="sm:max-w-2xl"
      title={isEdit ? 'Editar residente' : 'Nuevo residente'}
      description={isEdit ? `${resident.first_name} ${resident.last_name}` : 'Completa los datos del residente.'}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} loading={saving}>
            {isEdit ? 'Guardar cambios' : 'Crear residente'}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-5">
        <Alert>{serverError}</Alert>

        {/* Foto */}
        <div className="flex items-center gap-4">
          {photoPreview ? (
            <img src={photoPreview} alt="" className="size-20 rounded-full object-cover" />
          ) : currentHasPhoto ? (
            <ResidentAvatar resident={resident} size="lg" className="size-20" />
          ) : (
            <div className="flex size-20 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ImagePlus className="size-7" />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <label className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              <ImagePlus className="size-4" />
              {photoPreview || currentHasPhoto ? 'Cambiar foto' : 'Subir foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={(e) => {
                  setPhotoFile(e.target.files?.[0] ?? null);
                  setRemovePhoto(false);
                }}
              />
            </label>
            {(photoPreview || currentHasPhoto) && (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                onClick={() => {
                  setPhotoFile(null);
                  setRemovePhoto(true);
                }}
              >
                <Trash2 className="size-3.5" /> Quitar foto
              </button>
            )}
            <p className="text-xs text-slate-500">JPG, PNG o WEBP · máx. 5 MB</p>
          </div>
        </div>

        <FormSection title="Datos personales">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombres" htmlFor="first_name" error={errors.first_name}>
              <Input id="first_name" value={values.first_name} onChange={set('first_name')} aria-invalid={!!errors.first_name} />
            </Field>
            <Field label="Apellidos" htmlFor="last_name" error={errors.last_name}>
              <Input id="last_name" value={values.last_name} onChange={set('last_name')} aria-invalid={!!errors.last_name} />
            </Field>
            <Field label="RUT" htmlFor="rut" error={errors.rut}>
              <Input
                id="rut"
                placeholder="12.345.678-9"
                value={values.rut}
                onChange={set('rut', formatRut)}
                aria-invalid={!!errors.rut}
                autoComplete="off"
              />
            </Field>
            <Field label="Fecha de nacimiento" htmlFor="birth_date" error={errors.birth_date}>
              <Input
                id="birth_date"
                type="date"
                min="1900-01-01"
                max={today()}
                value={values.birth_date}
                onChange={set('birth_date')}
                aria-invalid={!!errors.birth_date}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Ubicación">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Sede" htmlFor="site_id" error={errors.site_id}>
              <Select id="site_id" value={values.site_id} onChange={set('site_id')} aria-invalid={!!errors.site_id}>
                <option value="">Selecciona…</option>
                {sites.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Habitación" htmlFor="room" error={errors.room}>
              <Input id="room" placeholder="Ej: 12" value={values.room} onChange={set('room')} aria-invalid={!!errors.room} />
            </Field>
            <Field label="Cama" htmlFor="bed" error={errors.bed} hint="Opcional">
              <Input id="bed" placeholder="Ej: A" value={values.bed} onChange={set('bed')} aria-invalid={!!errors.bed} />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Ingreso y mensualidad">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha de ingreso" htmlFor="admission_date" error={errors.admission_date}>
              <Input
                id="admission_date"
                type="date"
                min={values.birth_date || '1900-01-01'}
                max={today()}
                value={values.admission_date}
                onChange={set('admission_date')}
                aria-invalid={!!errors.admission_date}
              />
            </Field>
            <Field
              label="Mensualidad"
              htmlFor="monthly_fee_uf"
              error={errors.monthly_fee_uf}
              hint={uf && fee > 0 ? `≈ ${formatClp(fee * uf.value)} con la UF de hoy` : 'En UF, ej: 28,5'}
            >
              <div className="flex h-10 overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/30">
                <input
                  id="monthly_fee_uf"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={values.monthly_fee_uf}
                  onChange={set('monthly_fee_uf', (v) => v.replace(/[^\d.,]/g, ''))}
                  aria-invalid={!!errors.monthly_fee_uf || undefined}
                  className="w-full min-w-0 bg-transparent px-3 text-sm tabular-nums text-slate-900 placeholder:text-slate-400 focus:outline-none"
                />
                <span className="flex select-none items-center border-l border-slate-300 bg-slate-50 px-3 text-sm font-medium text-slate-600">
                  UF
                </span>
              </div>
            </Field>
            <Field label="Día de pago" htmlFor="payment_due_day" error={errors.payment_due_day} hint="De cada mes">
              <Select
                id="payment_due_day"
                value={values.payment_due_day}
                onChange={set('payment_due_day')}
                aria-invalid={!!errors.payment_due_day}
              >
                <option value="">Selecciona…</option>
                {PAYMENT_DAYS.map((d) => (
                  <option key={d} value={d}>
                    Día {d}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </FormSection>

        <FormSection title="Salud y cobertura">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Previsión" htmlFor="health_system" error={errors.health_system}>
              <Select
                id="health_system"
                value={values.health_system}
                onChange={(e) => {
                  set('health_system')(e);
                  setErrors((errs) => ({ ...errs, isapre: undefined }));
                }}
                aria-invalid={!!errors.health_system}
              >
                <option value="">Selecciona…</option>
                {HEALTH_SYSTEMS.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </Select>
            </Field>
            {values.health_system === 'ISAPRE' ? (
              <Field label="Isapre" htmlFor="isapre" error={errors.isapre}>
                <Select id="isapre" value={values.isapre} onChange={set('isapre')} aria-invalid={!!errors.isapre}>
                  <option value="">Selecciona…</option>
                  {catalogOptions(catalogs.isapres, resident?.isapre).map((i) => (
                    <option key={i.value} value={i.value}>
                      {i.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <div className="hidden sm:block" />
            )}
            <Field label="Ambulancia" htmlFor="ambulance" error={errors.ambulance}>
              <Select id="ambulance" value={values.ambulance} onChange={set('ambulance')} aria-invalid={!!errors.ambulance}>
                <option value="">Selecciona…</option>
                {catalogOptions(catalogs.ambulances, resident?.ambulance).map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Inscrito en CESFAM" error={errors.has_cesfam}>
              <div role="radiogroup" aria-label="Inscrito en CESFAM" className="grid h-10 grid-cols-2 gap-2">
                {[
                  ['yes', 'Sí'],
                  ['no', 'No'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={values.has_cesfam === value}
                    onClick={() => set('has_cesfam')({ target: { value } })}
                    className={
                      values.has_cesfam === value
                        ? 'rounded-lg border-2 border-brand-500 bg-brand-50 text-sm font-medium text-brand-800'
                        : 'rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-50'
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="Lugar de atención (opcional)" htmlFor="care_place" error={errors.care_place} className="sm:col-span-2">
              <Input
                id="care_place"
                maxLength={120}
                placeholder="Ej: Clínica Las Condes, Hospital del Salvador"
                value={values.care_place}
                onChange={set('care_place')}
              />
            </Field>
          </div>
        </FormSection>

        <FormSection title="Valoración">
          <div className="grid gap-4 sm:grid-cols-3">
            {[
              ['dependency_level', 'Índice de Katz', 'Dependencia funcional', DEPENDENCY_LEVELS],
              ['cognitive_level', 'Índice de Pfeiffer', 'Estado cognitivo', COGNITIVE_LEVELS],
              ['pressure_risk', 'Escala de Norton', 'Riesgo de úlceras por presión', PRESSURE_RISKS],
            ].map(([key, label, hint, options]) => (
              <Field key={key} label={label} htmlFor={key} error={errors[key]} hint={hint}>
                <Select id={key} value={values[key]} onChange={set(key)} aria-invalid={!!errors[key]}>
                  <option value="">Selecciona…</option>
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            ))}
          </div>
        </FormSection>

        {/* Apoderados: mínimo 1, máximo 2 */}
        <section className="space-y-3 border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Apoderados</h3>
              <p className="text-xs text-slate-500">Obligatorio al menos uno · máximo {MAX_GUARDIANS}</p>
            </div>
            {values.guardians.length < MAX_GUARDIANS && (
              <Button type="button" variant="outline" size="sm" onClick={addGuardian}>
                <UserPlus className="size-4" /> Agregar apoderado
              </Button>
            )}
          </div>
          {errors.guardians && <p className="text-xs text-red-600">{errors.guardians}</p>}

          <datalist id={`${formId}-relationships`}>
            {RELATIONSHIPS.map((r) => (
              <option key={r} value={r} />
            ))}
          </datalist>

          {values.guardians.map((link, i) => (
            <GuardianLinkEditor
              key={i}
              index={i}
              link={link}
              errors={errors}
              formId={formId}
              canRemove={values.guardians.length > 1}
              excludeIds={values.guardians.filter((_, j) => j !== i).map((g) => g.selected?.id).filter(Boolean)}
              onChange={(patch, clear) => updateLink(i, patch, clear)}
              onRemove={() => removeGuardian(i)}
            />
          ))}
        </section>

        <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-3">
          <input
            type="checkbox"
            checked={values.is_active}
            onChange={set('is_active')}
            className="size-4 rounded border-slate-300 accent-brand-600"
          />
          <span className="text-sm">
            <span className="font-medium text-slate-900">Residente activo</span>
            <span className="block text-slate-500">Los inactivos no aparecen en la vista de cuidadoras.</span>
          </span>
        </label>
      </form>
    </Dialog>
  );
}

function FormSection({ title, children }) {
  return (
    <section className="space-y-3 border-t border-slate-100 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function GuardianLinkEditor({ index, link, errors, formId, canRemove, excludeIds, onChange, onRemove }) {
  const err = (key) => errors[`guardians.${index}.${key}`];
  const fid = `${formId}-g${index}`;
  const newErrors = Object.fromEntries(
    ['full_name', 'rut', 'phone', 'email', 'address'].map((f) => [f, err(`guardian.${f}`)]),
  );

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {index === 0 ? 'Apoderado principal' : 'Segundo apoderado'}
        </span>
        {canRemove && (
          <button type="button" onClick={onRemove} className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline">
            <Trash2 className="size-3.5" /> Quitar
          </button>
        )}
      </div>

      {link.mode === 'existing' && link.selected ? (
        <div className="flex items-center gap-3 rounded-lg border border-accent-200 bg-white px-3 py-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent-100 text-accent-800">
            <UserRound className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{link.selected.full_name}</p>
            <p className="text-xs text-slate-500">
              {formatPhone(link.selected.phone)}
              {link.selected.rut && ` · ${formatRut(link.selected.rut)}`}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange({ selected: null }, ['guardian_id'])}
            aria-label="Cambiar apoderado"
          >
            <X className="size-4" /> Cambiar
          </Button>
        </div>
      ) : link.mode === 'existing' ? (
        <Field htmlFor={`${fid}-search`} error={err('guardian_id')}>
          <GuardianPicker
            inputId={`${fid}-search`}
            excludeIds={excludeIds}
            invalid={!!err('guardian_id')}
            onSelect={(g) => onChange({ selected: g }, ['guardian_id'])}
          />
          <button
            type="button"
            onClick={() => onChange({ mode: 'new' }, ['guardian_id'])}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            <UserPlus className="size-4" /> No está registrado: crear nuevo apoderado
          </button>
        </Field>
      ) : (
        <div className="space-y-3">
          <GuardianFields
            idPrefix={fid}
            values={link.data}
            errors={newErrors}
            onChange={(key, value) => onChange({ data: { ...link.data, [key]: value } }, [`guardian.${key}`])}
          />
          <button
            type="button"
            onClick={() => onChange({ mode: 'existing', data: EMPTY_GUARDIAN })}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline"
          >
            <Search className="size-4" /> Buscar un apoderado ya registrado
          </button>
        </div>
      )}

      <Field label="Parentesco con el residente" htmlFor={`${fid}-rel`} error={err('relationship')} className="sm:max-w-xs">
        <Input
          id={`${fid}-rel`}
          list={`${formId}-relationships`}
          placeholder="Ej: Hija"
          value={link.relationship}
          onChange={(e) => onChange({ relationship: e.target.value }, ['relationship'])}
          aria-invalid={!!err('relationship')}
        />
      </Field>
    </div>
  );
}
