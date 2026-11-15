import { z } from 'zod';
import { isValidRut, normalizeRut } from '../../utils/rut.js';
import { phoneSchema } from '../guardians/guardians.validators.js';

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (formato 24 h, ej. 10:30)');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');
const name = (max, message) => z.string({ message }).trim().min(1, message).max(max);

/** Documento del visitante: RUT chileno (módulo 11) u otro documento (pasaporte, DNI). */
const docFields = {
  doc_type: z.enum(['RUT', 'OTRO']).default('RUT'),
  doc_number: z.string({ message: 'Ingresa tu documento' }).trim().min(1, 'Ingresa tu documento').max(20),
};
const normalizeDoc = (d, ctx) => {
  if (d.doc_type === 'RUT') {
    if (!isValidRut(d.doc_number)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'RUT inválido: revisa los números y el dígito verificador', path: ['doc_number'] });
      return z.NEVER;
    }
    return { ...d, doc_number: normalizeRut(d.doc_number) };
  }
  return { ...d, doc_number: d.doc_number.toUpperCase().replace(/[^A-Z0-9]/g, '') || d.doc_number };
};

export const lookupSchema = z.object(docFields).transform(normalizeDoc);

export const availabilityQuerySchema = z.object({
  site_id: z.coerce.number().int().positive(),
});

/**
 * Reserva pública. Si el RUT es de un apoderado registrado basta con `resident_id`
 * (uno de sus residentes); si no, se piden nombre, apellido, teléfono, sede y el nombre del residente.
 * Esa decisión la toma el servicio: aquí todo lo del visitante es opcional.
 */
export const publicBookingSchema = z
  .object({
    ...docFields,
    first_name: z.string().trim().max(80).optional(),
    last_name: z.string().trim().max(80).optional(),
    phone: phoneSchema.optional(),
    site_id: z.coerce.number().int().positive().optional(),
    resident_id: z.string().uuid().optional(),
    resident_name: z.string().trim().max(160).optional(),
    date: isoDate,
    start: hhmm,
    accept_terms: z.literal(true, { errorMap: () => ({ message: 'Debes aceptar las condiciones' }) }),
  })
  .transform(normalizeDoc);

export const cancelSchema = z
  .object({
    code: z
      .string({ message: 'Ingresa el código' })
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9]{6}$/, 'El código tiene 6 caracteres'),
    ...docFields,
  })
  .transform(normalizeDoc);

// --- Panel interno ---
export const dayQuerySchema = z.object({
  site_id: z.coerce.number().int().positive().optional(),
  date: isoDate.optional(),
});

/** Visita agendada por el equipo: un apoderado del residente u otra persona (nombre + parentesco). */
export const staffBookingSchema = z
  .object({
    resident_id: z.string({ message: 'Selecciona el residente' }).uuid('Selecciona el residente'),
    guardian_id: z.string().uuid('Apoderado inválido').nullish(),
    visitor_name: z.string().trim().max(160).nullish(),
    relationship: z
      .string()
      .trim()
      .max(40)
      .nullish()
      .transform((v) => v || null),
    phone: z.preprocess((v) => (v === '' ? null : v), phoneSchema.nullish()),
    date: isoDate,
    start: hhmm,
  })
  .refine((v) => Boolean(v.guardian_id) !== Boolean(v.visitor_name), {
    message: 'Selecciona un apoderado o escribe el nombre de quien visita',
    path: ['visitor_name'],
  });

export const rejectSchema = z.object({
  reason: z
    .string()
    .trim()
    .max(200)
    .nullish()
    .transform((v) => v || null),
});

// --- Configuración (Soporte) ---
export const bookingSettingsSchema = z
  .object({
    enabled: z.boolean(),
    cutoff_time: hhmm,
    days_ahead: z.coerce.number().int().min(1, 'Mínimo 1 día').max(60, 'Máximo 60 días'),
    blocks: z
      .array(
        z
          .object({
            start: hhmm,
            end: hhmm,
            capacity: z.coerce.number().int().min(1, 'Cupo mínimo 1').max(10, 'Cupo máximo 10'),
            active: z.boolean().default(true),
          })
          .refine((b) => b.end > b.start, { message: 'El término debe ser después del inicio', path: ['end'] }),
      )
      .max(12, 'Máximo 12 bloques')
      .transform((list) => [...list].sort((a, b) => a.start.localeCompare(b.start)))
      .refine((list) => list.every((b, i) => i === 0 || b.start >= list[i - 1].end), 'Hay bloques que se topan'),
    // Límites de la página pública (el equipo puede agendar por sobre ellos)
    limits: z
      .object({
        per_person_day: z.coerce.number().int().min(1, 'Mínimo 1').max(10, 'Máximo 10'),
        per_person_week: z.coerce.number().int().min(1, 'Mínimo 1').max(30, 'Máximo 30'),
        per_resident_day: z.coerce.number().int().min(1, 'Mínimo 1').max(20, 'Máximo 20'),
      })
      .default({ per_person_day: 1, per_person_week: 3, per_resident_day: 2 }),
    blocked_dates: z
      .array(z.object({ date: isoDate, reason: z.string().trim().max(80).default('') }))
      .max(100)
      .transform((list) => [...new Map(list.map((d) => [d.date, d])).values()].sort((a, b) => a.date.localeCompare(b.date))),
  });
