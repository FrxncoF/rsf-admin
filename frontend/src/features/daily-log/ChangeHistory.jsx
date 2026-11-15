import { useState } from 'react';
import { ChevronDown, History } from 'lucide-react';
import { Spinner } from '@/components/ui/Feedback';
import {
  ALERTS,
  BRISTOL,
  DIURESIS_ASPECT,
  DIURESIS_FREQ,
  DYSPHAGIA,
  HYDRATION,
  HYGIENE,
  INTAKE,
  MEALS,
  MOBILITY,
  MOODS,
  POSITIONS,
  SKIN,
  SLEEP,
  SLEEP_SHIFTS,
  VITALS,
  labelOf,
} from './options';
import { formatTime, shortName } from './form';
import { dailyLogsApi } from './dailyLogsApi';

// Nombre legible y catálogo de cada dato de la ficha ("vitals.pa_s" → "PA sist.")
const FIELDS = {
  ...Object.fromEntries(VITALS.map((v) => [`vitals.${v.key}`, { label: v.label, unit: v.unit }])),
  ...Object.fromEntries(MEALS.map((m) => [`meals.${m.key}`, { label: m.label, options: INTAKE }])),
  ...Object.fromEntries(SLEEP_SHIFTS.map((s) => [`sleep.${s.key}`, { label: `Sueño · ${s.label}`, options: SLEEP }])),
  hydration: { label: 'Hidratación', options: HYDRATION },
  dysphagia: { label: 'Deglución', options: DYSPHAGIA },
  'diuresis.freq': { label: 'Diuresis', options: DIURESIS_FREQ },
  'diuresis.aspect': { label: 'Aspecto orina', options: DIURESIS_ASPECT },
  'bowel.evacuated': { label: 'Evacuó', format: (v) => (v ? 'Sí' : 'No') },
  'bowel.bristol': { label: 'Bristol', options: BRISTOL },
  hygiene: { label: 'Higiene', options: HYGIENE },
  diapers: { label: 'Pañales' },
  skin: { label: 'Piel', options: SKIN },
  skinZones: { label: 'Zonas' },
  mobility: { label: 'Movilidad', options: MOBILITY },
  postures: { label: 'Posiciones', format: (list) => list.map((p) => `${formatTime(p.at)} ${labelOf(POSITIONS, p.position)}`).join(', ') },
  mood: { label: 'Ánimo', options: MOODS },
  alerts: { label: 'Alertas', options: ALERTS },
  painLevel: { label: 'Dolor', unit: '/10' },
  notes: { label: 'Observaciones' },
};

function show(field, value) {
  if (value == null || value === '' || (Array.isArray(value) && value.length === 0)) return '—';
  if (field?.format) return field.format(value);
  if (Array.isArray(value)) return value.map((v) => (field?.options ? labelOf(field.options, v) : v)).join(', ');
  const text = field?.options ? labelOf(field.options, value) : typeof value === 'number' ? value.toLocaleString('es-CL') : String(value);
  return field?.unit ? `${text} ${field.unit}` : text;
}

/** Historial de cambios de la ficha (quién cambió qué y cuándo). Plegado por defecto. */
export function ChangeHistory({ logId, count }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');

  function toggle() {
    setOpen((o) => !o);
    if (!items) {
      dailyLogsApi
        .changes(logId)
        .then(setItems)
        .catch((err) => setError(err.message));
    }
  }

  return (
    <section className="border-t border-slate-200 pt-4">
      <button type="button" onClick={toggle} className="flex w-full items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700">
        <History className="size-4" /> Historial de cambios ({count})
        <ChevronDown className={`ml-auto size-4 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mt-2">
          {error && <p className="text-sm text-red-700">{error}</p>}
          {!items && !error ? (
            <Spinner className="size-5" />
          ) : (
            <ul className="space-y-2">
              {items?.map((c) => (
                <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <p className="text-xs text-slate-500">
                    {formatTime(c.changed_at)} · {shortName(c.author)}
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {Object.entries(c.changes).map(([key, [before, after]]) => {
                      const field = FIELDS[key];
                      return (
                        <li key={key} className="text-slate-800">
                          <span className="text-slate-500">{field?.label ?? key}:</span>{' '}
                          {before != null && before !== '' && !(Array.isArray(before) && !before.length) && (
                            <>
                              <s className="text-slate-400">{show(field, before)}</s> →{' '}
                            </>
                          )}
                          <span className="font-medium">{show(field, after)}</span>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
