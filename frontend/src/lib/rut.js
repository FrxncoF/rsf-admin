// Misma lógica que backend/src/utils/rut.js (módulo 11)

export const cleanRut = (value) => String(value ?? '').replace(/[^0-9kK]/g, '').toUpperCase();

function computeDv(body) {
  let sum = 0;
  let factor = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * factor;
    factor = factor === 7 ? 2 : factor + 1;
  }
  const rest = 11 - (sum % 11);
  return rest === 11 ? '0' : rest === 10 ? 'K' : String(rest);
}

export function isValidRut(value) {
  const clean = cleanRut(value);
  if (clean.length < 2) return false;
  const body = clean.slice(0, -1).replace(/^0+/, '');
  return /^[1-9]\d{5,7}$/.test(body) && computeDv(body) === clean.slice(-1);
}

/** "123456785" -> "12.345.678-5" (formatea mientras se escribe) */
export function formatRut(value) {
  const clean = cleanRut(value);
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1).replace(/^0+/, '');
  return `${body.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}-${clean.slice(-1)}`;
}
