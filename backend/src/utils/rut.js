// Utilidades de RUT chileno (módulo 11)

export function cleanRut(value) {
  return String(value ?? '').replace(/[^0-9kK]/g, '').toUpperCase();
}

export function computeDv(body) {
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  if (rest === 11) return '0';
  if (rest === 10) return 'K';
  return String(rest);
}

/** Devuelve el RUT en formato canónico "12345678-K" o null si no es parseable. */
export function normalizeRut(value) {
  const clean = cleanRut(value);
  if (clean.length < 2) return null;
  const body = clean.slice(0, -1).replace(/^0+/, '');
  const dv = clean.slice(-1);
  if (!/^\d+$/.test(body)) return null;
  return `${body}-${dv}`;
}

export function isValidRut(value) {
  const normalized = normalizeRut(value);
  if (!normalized) return false;
  const [body, dv] = normalized.split('-');
  if (!/^[1-9]\d{5,7}$/.test(body)) return false;
  return computeDv(body) === dv;
}
