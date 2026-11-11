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
  POSITIONS,
  SECTIONS,
  SKIN,
  SLEEP,
  SLEEP_SHIFTS,
  VITALS,
  labelOf,
  moodByValue,
} from './options';
import { formatTime, vitalStatus } from './form';

const toneOf = (options, value) => options.find((o) => o.value === value)?.tone;

/** "PA 120/80 · FC 72 · T° 36.5 · SpO₂ 96%" (o '' si no hay signos) */
export function describeVitals(v = {}) {
  const parts = [];
  if (v.pa_s != null || v.pa_d != null) parts.push(`PA ${v.pa_s ?? '—'}/${v.pa_d ?? '—'}`);
  if (v.fc != null) parts.push(`FC ${v.fc}`);
  if (v.temp != null) parts.push(`T° ${String(v.temp).replace('.', ',')}`);
  if (v.spo2 != null) parts.push(`SpO₂ ${v.spo2}%`);
  return parts.join(' · ');
}

/**
 * Ficha guardada → secciones con solo los datos registrados, para la vista de lectura.
 * tone: 'good' | 'neutral' | 'warn' | 'bad' (colorea el valor).
 */
export function summarize(d) {
  const sections = [];
  const add = (key, items) => {
    const filled = items.filter(Boolean);
    if (filled.length) sections.push({ key, title: SECTIONS[key], items: filled });
  };

  add(
    'vitals',
    VITALS.filter((def) => d.vitals?.[def.key] != null).map((def) => ({
      label: def.label,
      value: `${String(d.vitals[def.key]).replace('.', ',')} ${def.unit}`,
      tone: vitalStatus(def, d.vitals[def.key]) === 'alert' ? 'warn' : undefined,
    })),
  );

  add('intake', [
    ...MEALS.filter((m) => d.meals?.[m.key]).map((m) => ({
      label: m.label,
      value: labelOf(INTAKE, d.meals[m.key]),
      tone: toneOf(INTAKE, d.meals[m.key]),
    })),
    d.hydration && { label: 'Hidratación', value: labelOf(HYDRATION, d.hydration), tone: toneOf(HYDRATION, d.hydration) },
    d.dysphagia && { label: 'Deglución', value: labelOf(DYSPHAGIA, d.dysphagia), tone: toneOf(DYSPHAGIA, d.dysphagia) },
  ]);

  const bristol = BRISTOL.find((b) => b.value === d.bowel?.bristol);
  add('hygiene', [
    d.diuresis?.freq && { label: 'Diuresis', value: labelOf(DIURESIS_FREQ, d.diuresis.freq), tone: toneOf(DIURESIS_FREQ, d.diuresis.freq) },
    d.diuresis?.aspect && { label: 'Aspecto orina', value: labelOf(DIURESIS_ASPECT, d.diuresis.aspect), tone: toneOf(DIURESIS_ASPECT, d.diuresis.aspect) },
    d.bowel?.evacuated != null && {
      label: 'Deposición',
      value: d.bowel.evacuated ? `Evacuó${bristol ? ` · Bristol ${bristol.value} (${bristol.label.toLowerCase()})` : ''}` : 'No evacuó',
      tone: d.bowel.evacuated ? bristol?.tone ?? 'good' : 'warn',
    },
    d.hygiene?.length > 0 && { label: 'Higiene', value: d.hygiene.map((h) => labelOf(HYGIENE, h)).join(', ') },
    d.diapers > 0 && { label: 'Cambios de pañal', value: String(d.diapers) },
  ]);

  const injured = d.skin?.filter((s) => s !== 'sana' && s !== 'seca') ?? [];
  add('skin', [
    d.skin?.length > 0 && {
      label: 'Piel',
      value: `${d.skin.map((s) => labelOf(SKIN, s)).join(', ')}${d.skinZones?.length ? ` (${d.skinZones.join(', ')})` : ''}`,
      tone: injured.length ? 'warn' : 'good',
    },
    d.mobility && { label: 'Movilidad', value: labelOf(MOBILITY, d.mobility), tone: toneOf(MOBILITY, d.mobility) },
    d.postures?.length > 0 && {
      label: 'Posturas',
      value: d.postures.map((p) => `${formatTime(p.at)} ${labelOf(POSITIONS, p.position)}`).join(' · '),
    },
  ]);

  const mood = moodByValue(d.mood);
  add('wellbeing', [
    mood && { label: 'Ánimo', value: `${mood.emoji} ${mood.label}`, tone: mood.tone },
    ...SLEEP_SHIFTS.filter((s) => d.sleep?.[s.key]).map((s) => ({
      label: `Sueño ${s.label.toLowerCase()}`,
      value: labelOf(SLEEP, d.sleep[s.key]),
      tone: toneOf(SLEEP, d.sleep[s.key]),
    })),
    d.alerts?.length > 0 && {
      label: 'Eventos',
      value: d.alerts.map((a) => (a === 'dolor' && d.painLevel ? `Dolor ${d.painLevel}/10` : labelOf(ALERTS, a))).join(', '),
      tone: 'bad',
    },
    d.notes && { label: 'Observación', value: d.notes, wide: true },
  ]);

  return sections;
}

/** Eventos de la ficha como texto corto para la lista ("Caída, Dolor 7/10"). */
export const alertsText = (d) =>
  (d.alerts ?? []).map((a) => (a === 'dolor' && d.painLevel ? `Dolor ${d.painLevel}/10` : labelOf(ALERTS, a))).join(', ');
