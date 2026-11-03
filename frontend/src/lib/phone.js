// Teléfonos de Chile: prefijo fijo +56 y 9 dígitos (móvil 9XXXXXXXX o fijo 2XXXXXXXX).
// En la BD se guardan como "+56912345678".

export const PHONE_PREFIX = '+56';
export const PHONE_DIGITS = 9;

/** Deja solo los 9 dígitos locales (quita +56, espacios, etc.). */
export function localDigits(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  const local = digits.startsWith('56') && digits.length > PHONE_DIGITS ? digits.slice(2) : digits;
  return local.slice(0, PHONE_DIGITS);
}

export const isValidLocalPhone = (digits) => new RegExp(`^\\d{${PHONE_DIGITS}}$`).test(digits);

export const toStoredPhone = (digits) => `${PHONE_PREFIX}${digits}`;

/** "+56912345678" → "+56 9 1234 5678" */
export function formatPhone(value) {
  const d = localDigits(value);
  if (d.length !== PHONE_DIGITS) return value ?? '';
  return `${PHONE_PREFIX} ${d[0]} ${d.slice(1, 5)} ${d.slice(5)}`;
}

/** Para enlaces tel: */
export const phoneHref = (value) => `tel:${PHONE_PREFIX}${localDigits(value)}`;
