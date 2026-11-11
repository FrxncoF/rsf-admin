import { VITALS } from './options';

/** Estado inicial de una ficha nueva. Los signos vitales se editan como texto. */
export const EMPTY_LOG = {
  vitals: Object.fromEntries(VITALS.map((v) => [v.key, ''])),
  meals: {}, // { desayuno: '100' | '75' | ... }
  hydration: null,
  dysphagia: null,
  diuresis: { freq: null, aspect: null },
  bowel: { evacuated: null, bristol: null },
  hygiene: [],
  diapers: 0,
  skin: [],
  skinZones: [],
  mobility: null,
  postures: [], // [{ at, position }] — se registran con la hora del clic
  mood: null,
  sleep: { noche: null, dia: null },
  alerts: [],
  painLevel: null,
  notes: '',
};

/** 'empty' | 'invalid' | 'alert' (fuera de rango clínico) | 'ok' */
export function vitalStatus(def, raw) {
  if (raw === '' || raw == null) return 'empty';
  const n = Number(raw);
  if (Number.isNaN(n) || n < def.min || n > def.max) return 'invalid';
  if ((def.low != null && n < def.low) || (def.high != null && n >= def.high)) return 'alert';
  return 'ok';
}

export const hasInvalidVitals = (log) => VITALS.some((d) => vitalStatus(d, log.vitals[d.key]) === 'invalid');

/** Convierte el formulario al formato que guarda el API. */
export function toPayload(log) {
  const vitals = Object.fromEntries(VITALS.map((d) => [d.key, log.vitals[d.key] === '' ? null : Number(log.vitals[d.key])]));
  return { ...log, vitals, notes: log.notes.trim() };
}

/** ¿Se registró algo? No se permite guardar fichas vacías. */
export function isEmptyLog(log) {
  const p = toPayload(log);
  return !(
    Object.values(p.vitals).some((v) => v != null) ||
    Object.values(p.meals).some(Boolean) ||
    p.hydration || p.dysphagia || p.diuresis.freq || p.diuresis.aspect || p.mobility || p.mood ||
    p.bowel.evacuated != null ||
    p.hygiene.length || p.diapers || p.skin.length || p.postures.length ||
    p.sleep.noche || p.sleep.dia || p.alerts.length || p.notes
  );
}

export const formatTime = (iso) =>
  new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

/** "mar 10 nov" con mayúscula inicial */
export function formatDay(iso) {
  const text = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', month: 'short' })
    .format(new Date(iso))
    .replace(/[.,]/g, '');
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const shortName = (fullName = '') => {
  const [first = '', last = ''] = fullName.split(' ');
  return last ? `${first} ${last[0]}.` : first;
};
