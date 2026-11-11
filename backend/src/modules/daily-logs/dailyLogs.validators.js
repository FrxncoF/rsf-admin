import { z } from 'zod';

// Códigos de la ficha diaria (deben coincidir con frontend/src/features/daily-log/options.js)
const INTAKE = ['100', '75', '50', '25', 'rechaza'];
const MEALS = ['desayuno', 'almuerzo', 'once', 'cena'];
const HYDRATION = ['lt500', '500-1000', '1000-1500', '1500-2000', 'gt2000'];
const DYSPHAGIA = ['normal', 'leve', 'moderada', 'severa'];
const DIURESIS_FREQ = ['normal', 'aumentada', 'disminuida', 'anuria'];
const DIURESIS_ASPECT = ['clara', 'concentrada', 'turbia', 'hematurica'];
const HYGIENE = ['ducha', 'cama', 'bucal'];
const SKIN = ['sana', 'seca', 'eritema', 'hematoma', 'herida', 'escara_nueva', 'escara_tto'];
const SKIN_ZONES = ['Sacro', 'Glúteos', 'Talones', 'Caderas', 'Codos', 'Espalda', 'Piernas', 'Brazos', 'Otra'];
const MOBILITY = ['autovalente', 'ayuda_tecnica', 'asistido', 'postrado'];
const POSITIONS = ['supino', 'lateral_izq', 'lateral_der', 'sentado'];
const MOODS = ['alegre', 'tranquilo', 'apatico', 'triste', 'ansioso', 'confuso', 'irritable'];
const SLEEP = ['bien', 'despertares', 'insomnio', 'agitado'];
const ALERTS = ['caida', 'dolor', 'vomitos', 'fiebre'];

const choice = (values) => z.enum(values).nullable().default(null);
const many = (values) => z.array(z.enum(values)).max(values.length).default([]).transform((list) => [...new Set(list)]);
const vital = (min, max) => z.number().min(min).max(max).nullable().default(null);

const dataSchema = z.object({
  vitals: z
    .object({
      pa_s: vital(50, 260),
      pa_d: vital(30, 160),
      fc: vital(20, 250),
      temp: vital(30, 43),
      spo2: vital(50, 100),
    })
    .default({}),
  meals: z.object(Object.fromEntries(MEALS.map((m) => [m, choice(INTAKE)]))).default({}),
  hydration: choice(HYDRATION),
  dysphagia: choice(DYSPHAGIA),
  diuresis: z.object({ freq: choice(DIURESIS_FREQ), aspect: choice(DIURESIS_ASPECT) }).default({}),
  bowel: z
    .object({ evacuated: z.boolean().nullable().default(null), bristol: z.number().int().min(1).max(7).nullable().default(null) })
    .default({}),
  hygiene: many(HYGIENE),
  diapers: z.number().int().min(0).max(20).default(0),
  skin: many(SKIN),
  skinZones: many(SKIN_ZONES),
  mobility: choice(MOBILITY),
  postures: z
    .array(z.object({ at: z.string().datetime({ offset: true }), position: z.enum(POSITIONS) }))
    .max(24)
    .default([]),
  mood: choice(MOODS),
  sleep: z.object({ noche: choice(SLEEP), dia: choice(SLEEP) }).default({}),
  alerts: many(ALERTS),
  painLevel: z.number().int().min(1).max(10).nullable().default(null),
  notes: z.string().trim().max(150).default(''),
});

/** ¿La ficha tiene al menos un dato? (no se guardan fichas vacías) */
function hasContent(d) {
  return (
    Object.values(d.vitals).some((v) => v != null) ||
    Object.values(d.meals).some(Boolean) ||
    Boolean(d.hydration || d.dysphagia || d.diuresis.freq || d.diuresis.aspect || d.mobility || d.mood) ||
    d.bowel.evacuated != null ||
    d.hygiene.length > 0 ||
    d.diapers > 0 ||
    d.skin.length > 0 ||
    d.postures.length > 0 ||
    Boolean(d.sleep.noche || d.sleep.dia) ||
    d.alerts.length > 0 ||
    d.notes !== ''
  );
}

export const createDailyLogSchema = z.object({
  resident_id: z.string({ message: 'Indica el residente' }).uuid('Residente inválido'),
  data: dataSchema
    .refine(hasContent, 'La ficha está vacía')
    // Consistencia: sin evacuación no hay Bristol; sin dolor no hay intensidad; sin lesión no hay zona
    .transform((d) => ({
      ...d,
      bowel: { ...d.bowel, bristol: d.bowel.evacuated ? d.bowel.bristol : null },
      painLevel: d.alerts.includes('dolor') ? d.painLevel : null,
      skinZones: d.skin.some((s) => !['sana', 'seca'].includes(s)) ? d.skinZones : [],
    })),
});

export const listDailyLogsQuerySchema = z.object({
  resident_id: z.string({ message: 'Indica el residente' }).uuid('Residente inválido'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export const noteSchema = z.object({
  body: z.string({ message: 'Escribe la nota' }).trim().min(1, 'Escribe la nota').max(300, 'Máximo 300 caracteres'),
});
