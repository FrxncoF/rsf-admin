import { Field, Input, PhoneInput } from '@/components/ui/Form';
import { formatRut, isValidRut } from '@/lib/rut';
import { isValidLocalPhone, localDigits, PHONE_DIGITS, toStoredPhone } from '@/lib/phone';

export const EMPTY_GUARDIAN = { full_name: '', rut: '', phone: '', email: '', address: '' };
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/** Errores por campo (mismas claves que devuelve la API). */
export function validateGuardian(g) {
  const errors = {};
  if (g.full_name.trim().length < 2) errors.full_name = 'Ingresa el nombre del apoderado';
  if (!g.phone) errors.phone = 'Ingresa el teléfono';
  else if (!isValidLocalPhone(g.phone)) errors.phone = `Debe tener ${PHONE_DIGITS} dígitos (faltan ${PHONE_DIGITS - g.phone.length})`;
  if (g.rut && !isValidRut(g.rut)) errors.rut = 'RUT inválido';
  if (g.email.trim() && !EMAIL_RE.test(g.email.trim())) errors.email = 'Correo inválido';
  return errors;
}

export const toGuardianForm = (g) => ({
  full_name: g.full_name ?? '',
  rut: g.rut ? formatRut(g.rut) : '',
  phone: localDigits(g.phone),
  email: g.email ?? '',
  address: g.address ?? '',
});

export const toGuardianPayload = (g) => ({
  full_name: g.full_name.trim(),
  rut: g.rut || null,
  phone: toStoredPhone(g.phone),
  email: g.email.trim() || null,
  address: g.address.trim() || null,
});

/**
 * Campos del apoderado. Se usa en el módulo Apoderados y al crear uno
 * nuevo desde el formulario del residente.
 */
export function GuardianFields({ values, errors = {}, onChange, idPrefix }) {
  const fid = (field) => `${idPrefix}-${field}`;
  const set = (key, transform = (v) => v) => (e) => onChange(key, transform(e.target.value));

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Nombre completo" htmlFor={fid('name')} error={errors.full_name} className="sm:col-span-2">
        <Input id={fid('name')} value={values.full_name} onChange={set('full_name')} aria-invalid={!!errors.full_name} />
      </Field>
      <Field label="Teléfono" htmlFor={fid('phone')} error={errors.phone} hint={`${PHONE_DIGITS} dígitos`}>
        <PhoneInput id={fid('phone')} value={values.phone} onChange={(digits) => onChange('phone', digits)} invalid={!!errors.phone} />
      </Field>
      <Field label="RUT" htmlFor={fid('rut')} error={errors.rut} hint="Opcional">
        <Input
          id={fid('rut')}
          placeholder="12.345.678-9"
          value={values.rut}
          onChange={set('rut', formatRut)}
          aria-invalid={!!errors.rut}
          autoComplete="off"
        />
      </Field>
      <Field label="Correo" htmlFor={fid('email')} error={errors.email} hint="Opcional">
        <Input id={fid('email')} type="email" value={values.email} onChange={set('email')} aria-invalid={!!errors.email} />
      </Field>
      <Field label="Dirección" htmlFor={fid('addr')} error={errors.address} hint="Opcional">
        <Input id={fid('addr')} value={values.address} onChange={set('address')} />
      </Field>
    </div>
  );
}
