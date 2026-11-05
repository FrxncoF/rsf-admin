import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '@/features/auth/AuthContext';

/** Estructura de la bitácora de un residente para un día. */
export const EMPTY_LOG = {
  vitals: [], // [{ id, at, by, pa_s, pa_d, fc, temp, spo2, hgt }]
  meals: {}, // { desayuno: '100' | '75' | ... }
  hydration: null,
  dysphagia: null,
  diuresis: { freq: null, aspect: null },
  bowel: { evacuated: null, bristol: null },
  hygiene: [], // ['ducha', 'cama', ...]
  diapers: 0,
  skin: [],
  skinZones: [],
  mobility: null,
  postures: [], // [{ id, at, by, position }]
  mood: null,
  sleep: { noche: null, dia: null },
  alerts: [],
  painLevel: null,
  notes: '',
};

let seq = 0;
const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}`;

/**
 * Estado local de la bitácora diaria + registro de auditoría.
 *
 * Cada cambio se registra como { section, text, by, at }. En Fase 2 cada acción
 * pasará a ser un PATCH/POST al backend (que estampará autor y hora) y `audit`
 * vendrá del servidor; la firma de este hook está pensada para no cambiar la UI.
 */
export function useDailyLog(initial = EMPTY_LOG) {
  const { user } = useAuth();
  const [log, setLog] = useState(initial);
  const [audit, setAudit] = useState([]);

  const record = useCallback(
    (section, text) => {
      const entry = { id: newId(), section, text, by: user.full_name, at: new Date().toISOString() };
      setAudit((a) => [entry, ...a]);
      return entry;
    },
    [user.full_name],
  );

  /** Reemplaza campos de primer nivel y deja traza. */
  const update = useCallback(
    (section, patch, text) => {
      setLog((l) => ({ ...l, ...(typeof patch === 'function' ? patch(l) : patch) }));
      record(section, text);
    },
    [record],
  );

  const addVitals = useCallback(
    (values, text) => {
      const entry = record('vitals', text);
      setLog((l) => ({ ...l, vitals: [{ id: entry.id, at: entry.at, by: entry.by, ...values }, ...l.vitals] }));
    },
    [record],
  );

  const addPosture = useCallback(
    (position, text) => {
      const entry = record('skin', text);
      setLog((l) => ({ ...l, postures: [{ id: entry.id, at: entry.at, by: entry.by, position }, ...l.postures] }));
    },
    [record],
  );

  // Última edición por sección (para el pie de cada tarjeta)
  const lastBySection = useMemo(() => {
    const map = {};
    for (const entry of audit) map[entry.section] ??= entry;
    return map;
  }, [audit]);

  return { log, audit, lastEdit: audit[0] ?? null, lastBySection, update, addVitals, addPosture };
}

export const formatTime = (iso) =>
  new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));

export const shortName = (fullName = '') => {
  const [first = '', last = ''] = fullName.split(' ');
  return last ? `${first} ${last[0]}.` : first;
};
