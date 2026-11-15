import { z } from 'zod';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (formato 24 h)');

export const DOSE_STATUSES = ['GIVEN', 'REFUSED', 'NOT_GIVEN'];

export const scheduleQuerySchema = z.object({
  site_id: z.coerce.number().int().positive().optional(),
  date: date.optional(), // por defecto, hoy en Chile
});

export const recordDoseSchema = z.object({
  medication_id: z.string().uuid('Medicamento inválido'),
  date,
  time,
  status: z.enum(DOSE_STATUSES, { message: 'Estado inválido' }),
  note: z
    .string()
    .trim()
    .max(200, 'Máximo 200 caracteres')
    .optional()
    .nullable()
    .transform((v) => v || null),
});
