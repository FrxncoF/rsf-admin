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

// Grupos que se guardan dato por dato (no pisan lo que anotó otra cuidadora)
const NESTED = ['vitals', 'meals', 'diuresis', 'bowel', 'sleep'];
const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/** Ficha guardada (API) → estado del formulario (los signos vitales se editan como texto). */
export function fromData(data = {}) {
  const base = { ...EMPTY_LOG, ...data };
  return {
    ...base,
    vitals: Object.fromEntries(VITALS.map((d) => [d.key, data.vitals?.[d.key] == null ? '' : String(data.vitals[d.key])])),
    meals: { ...(data.meals ?? {}) },
    diuresis: { ...EMPTY_LOG.diuresis, ...(data.diuresis ?? {}) },
    bowel: { ...EMPTY_LOG.bowel, ...(data.bowel ?? {}) },
    sleep: { ...EMPTY_LOG.sleep, ...(data.sleep ?? {}) },
    notes: data.notes ?? '',
  };
}

/**
 * Cambios entre lo último guardado (`base`) y lo que hay en pantalla (`log`), listos para el API.
 * Los signos vitales mal escritos no se envían (se guardan cuando queden en rango).
 */
export function changesBetween(base, log) {
  const a = toPayload(base);
  const b = toPayload(log);
  const patch = {};
  for (const key of Object.keys(b)) {
    if (NESTED.includes(key)) {
      const sub = {};
      for (const k of new Set([...Object.keys(a[key] ?? {}), ...Object.keys(b[key] ?? {})])) {
        if (key === 'vitals') {
          const def = VITALS.find((d) => d.key === k);
          if (def && vitalStatus(def, log.vitals[k]) === 'invalid') continue;
        }
        if (!same(a[key]?.[k], b[key]?.[k])) sub[k] = b[key]?.[k] ?? null;
      }
      if (Object.keys(sub).length) patch[key] = sub;
    } else if (!same(a[key], b[key])) {
      patch[key] = b[key];
    }
  }
  return patch;
}

/** Aplica cambios del formulario sobre otra versión (para no perder lo escrito mientras se guardaba). */
export function applyChanges(target, base, log) {
  const out = { ...target };
  for (const key of Object.keys(log)) {
    if (NESTED.includes(key)) {
      const merged = { ...target[key] };
      for (const k of new Set([...Object.keys(base[key] ?? {}), ...Object.keys(log[key] ?? {})])) {
        if (!same(base[key]?.[k], log[key]?.[k])) merged[k] = log[key][k];
      }
      out[key] = merged;
    } else if (!same(base[key], log[key])) {
      out[key] = log[key];
    }
  }
  return out;
}

/** "2026-11-15" → "15-11-2026" */
export const dmy = (iso) => iso.split('-').reverse().join('-');

const weekday = new Intl.DateTimeFormat('es-CL', { weekday: 'long', timeZone: 'UTC' });
/** "2026-11-15" → "domingo 15-11-2026" (para títulos: "Ficha del domingo 15-11-2026") */
export const dayAndDate = (iso) => `${weekday.format(new Date(`${iso}T12:00:00Z`))} ${dmy(iso)}`;

/** ¿Se registró algo? */
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
