import { z } from 'zod';

// Áreas (deben coincidir con frontend/src/features/daily-reports/areas.js)
export const AREAS = ['KINESIOLOGIA', 'TERAPIA_OCUPACIONAL', 'ENFERMERIA', 'ENCARGADA_TURNO'];

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida');
const area = z.enum(AREAS, { message: 'Área inválida' });
const body = z.string().trim().min(1, 'Escribe el resumen del día').max(10000, 'Máximo 10.000 caracteres');

export const listQuerySchema = z.object({
  site_id: z.coerce.number().int().positive().optional(),
  date: date.optional(), // por defecto, hoy en Chile
  area: area.optional(),
});

export const createSchema = z.object({
  site_id: z.coerce.number({ message: 'Elige una sede' }).int().positive({ message: 'Elige una sede' }),
  area,
  body,
});

export const updateSchema = z.object({ area: area.optional(), body: body.optional() });
