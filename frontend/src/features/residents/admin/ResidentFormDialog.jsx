import { useEffect, useId, useState } from 'react';
import { ImagePlus, Trash2, UserPlus } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Field, Input, PhoneInput } from '@/components/ui/Form';
import { Alert } from '@/components/ui/Feedback';
import { formatRut, isValidRut } from '@/lib/rut';
import { isValidLocalPhone, localDigits, PHONE_DIGITS, toStoredPhone } from '@/lib/phone';
import { residentsApi } from '../residentsApi';
import { ResidentAvatar } from '../ResidentAvatar';

export const MAX_GUARDIANS = 2;
const EMPTY_GUARDIAN = { full_name: '', relationship: '', phone: '', rut: '', email: '', address: '' };
const EMPTY = { first_name: '', last_name: '', rut: '', birth_date: '', room: '', bed: '', is_active: true, guardians: [EMPTY_GUARDIAN] };
const RELATIONSHIPS = ['Hijo', 'Hija', 'Nieto', 'Nieta', 'Cónyuge', 'Hermano', 'Hermana', 'Sobrino', 'Sobrina', 'Tutor legal', 'Otro'];
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const today = () => new Date().toISOString().slice(0, 10);

function validate(values) {
  const errors = {};
  if (!values.first_name.trim()) errors.first_name = 'Ingresa el nombre';
  if (!values.last_name.trim()) errors.last_name = 'Ingresa el apellido';
  if (!isValidRut(values.rut)) errors.rut = 'RUT inválido';
  if (!values.birth_date) errors.birth_date = 'Ingresa la fecha de nacimiento';
  else if (values.birth_date > today()) errors.birth_date = 'La fecha no puede ser futura';
  if (!values.room.trim()) errors.room = 'Ingresa la habitación';

  if (values.guardians.length < 1) errors.guardians = 'El residente debe tener al menos un apoderado';
  values.guardians.forEach((g, i) => {
    const key = (field) => `guardians.${i}.${field}`;
    if (g.full_name.trim().length < 2) errors[key('full_name')] = 'Ingresa el nombre del apoderado';
    if (!g.relationship.trim()) errors[key('relationship')] = 'Indica el parentesco';
    if (!g.phone) errors[key('phone')] = 'Ingresa el teléfono';
    else if (!isValidLocalPhone(g.phone)) errors[key('phone')] = `Debe tener ${PHONE_DIGITS} dígitos (faltan ${PHONE_DIGITS - g.phone.length})`;
    if (g.rut && !isValidRut(g.rut)) errors[key('rut')] = 'RUT inválido';
    if (g.email.trim() && !EMAIL_RE.test(g.email.trim())) errors[key('email')] = 'Correo inválido';
  });
  const [a, b] = values.guardians;
  if (a?.rut && b?.rut && a.rut === b.rut) errors['guardians.1.rut'] = 'No puede repetir el RUT del primer apoderado';
  return errors;
}

const toFormGuardian = (g) => ({
  full_name: g.full_name ?? '',
  relationship: g.relationship ?? '',
  phone: localDigits(g.phone),
  rut: g.rut ? formatRut(g.rut) : '',
  email: g.email ?? '',
  address: g.address ?? '',
});

const toPayloadGuardian = (g) => ({
  full_name: g.full_name.trim(),
  relationship: g.relationship.trim(),
  phone: toStoredPhone(g.phone),
  rut: g.rut || null,
  email: g.email.trim() || null,
  address: g.address.trim() || null,
});

export default function ResidentFormDialog({ open, resident, onClose, onSaved }) {
  const isEdit = Boolean(resident);
  const formId = useId();
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
            bed: resident.bed ?? '',
            guardians: resident.guardians?.length ? resident.guardians.map(toFormGuardian) : [EMPTY_GUARDIAN],
          }
        : EMPTY,
    );
    setErrors({});
    setServerError('');
    setPhotoFile(null);
    setRemovePhoto(false);
  }, [open, resident]);

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

  const updateGuardian = (index, key, value) => {
    setValues((v) => ({ ...v, guardians: v.guardians.map((g, i) => (i === index ? { ...g, [key]: value } : g)) }));
    setErrors((errs) => ({ ...errs, [`guardians.${index}.${key}`]: undefined, guardians: undefined }));
  };

  const setGuardian = (index, key, transform = (v) => v) => (e) => updateGuardian(index, key, transform(e.target.value));

  const addGuardian = () =>
    setValues((v) => (v.guardians.length >= MAX_GUARDIANS ? v : { ...v, guardians: [...v.guardians, EMPTY_GUARDIAN] }));

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
        room: values.room.trim(),
        bed: values.bed.trim() || null,
        is_active: values.is_active,
        guardians: values.guardians.map(toPayloadGuardian),
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

  return (
    <Dialog
      open={open}
      onClose={saving ? undefined : onClose}
      className="sm:max-w-2xl"
      title={isEdit ? 'Editar residente' : 'Nuevo residente'}
      description={isEdit ? `${resident.first_name} ${resident.last_name}` : 'Completa los datos básicos del residente.'}
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
      <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-4">
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
          <Field label="Habitación" htmlFor="room" error={errors.room}>
            <Input id="room" placeholder="Ej: 12" value={values.room} onChange={set('room')} aria-invalid={!!errors.room} />
          </Field>
          <Field label="Cama" htmlFor="bed" error={errors.bed} hint="Opcional">
            <Input id="bed" placeholder="Ej: A" value={values.bed} onChange={set('bed')} aria-invalid={!!errors.bed} />
          </Field>
        </div>

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

          {values.guardians.map((g, i) => {
            const err = (field) => errors[`guardians.${i}.${field}`];
            const fid = (field) => `${formId}-g${i}-${field}`;
            return (
              <div key={i} className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {i === 0 ? 'Apoderado principal' : 'Segundo apoderado'}
                  </span>
                  {values.guardians.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeGuardian(i)}
                      className="inline-flex items-center gap-1 text-xs text-red-600 hover:underline"
                    >
                      <Trash2 className="size-3.5" /> Quitar
                    </button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Nombre completo" htmlFor={fid('name')} error={err('full_name')} className="sm:col-span-2">
                    <Input id={fid('name')} value={g.full_name} onChange={setGuardian(i, 'full_name')} aria-invalid={!!err('full_name')} />
                  </Field>
                  <Field label="Parentesco" htmlFor={fid('rel')} error={err('relationship')}>
                    <Input
                      id={fid('rel')}
                      list={`${formId}-relationships`}
                      placeholder="Ej: Hija"
                      value={g.relationship}
                      onChange={setGuardian(i, 'relationship')}
                      aria-invalid={!!err('relationship')}
                    />
                  </Field>
                  <Field label="Teléfono" htmlFor={fid('phone')} error={err('phone')} hint={`${PHONE_DIGITS} dígitos`}>
                    <PhoneInput
                      id={fid('phone')}
                      value={g.phone}
                      onChange={(digits) => updateGuardian(i, 'phone', digits)}
                      invalid={!!err('phone')}
                    />
                  </Field>
                  <Field label="RUT" htmlFor={fid('rut')} error={err('rut')} hint="Opcional">
                    <Input
                      id={fid('rut')}
                      placeholder="12.345.678-9"
                      value={g.rut}
                      onChange={setGuardian(i, 'rut', formatRut)}
                      aria-invalid={!!err('rut')}
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Correo" htmlFor={fid('email')} error={err('email')} hint="Opcional">
                    <Input
                      id={fid('email')}
                      type="email"
                      value={g.email}
                      onChange={setGuardian(i, 'email')}
                      aria-invalid={!!err('email')}
                    />
                  </Field>
                  <Field label="Dirección" htmlFor={fid('addr')} error={err('address')} hint="Opcional" className="sm:col-span-2">
                    <Input id={fid('addr')} value={g.address} onChange={setGuardian(i, 'address')} />
                  </Field>
                </div>
              </div>
            );
          })}
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
