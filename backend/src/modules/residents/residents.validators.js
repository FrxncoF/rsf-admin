import { z } from 'zod';
import { isValidRut, normalizeRut } from '../../utils/rut.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Fecha inválida')
  .refine((value) => value >= '1900-01-01', 'Fecha demasiado antigua')
  .refine((value) => value <= new Date().toISOString().slice(0, 10), 'La fecha no puede ser futura');

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

export const MIN_GUARDIANS = 1;
export const MAX_GUARDIANS = 2;

const guardianSchema = z.object({
  full_name: z.string().trim().min(2, 'Ingresa el nombre del apoderado').max(160),
  relationship: z.string().trim().min(1, 'Indica el parentesco').max(40),
  // Chile: 9 dígitos después del +56. Acepta "912345678", "+56912345678" o con espacios;
  // se guarda siempre como "+56912345678".
  phone: z
    .string()
    .transform((value) => value.replace(/[\s()-]/g, ''))
    .refine((value) => /^(\+?56)?\d{9}$/.test(value), 'El teléfono debe tener 9 dígitos después del +56')
    .transform((value) => `+56${value.slice(-9)}`),
  rut: z
    .string()
    .trim()
    .nullish()
    .transform((value) => value || null)
    .refine((value) => value === null || isValidRut(value), 'RUT inválido')
    .transform((value) => (value ? normalizeRut(value) : null)),
  email: optionalText(160).refine((value) => value === null || z.string().email().safeParse(value).success, 'Correo inválido'),
  address: optionalText(200),
});

// El orden del arreglo define la posición: [0] = principal, [1] = secundario
const guardiansSchema = z
  .array(guardianSchema, { message: 'Ingresa los apoderados' })
  .min(MIN_GUARDIANS, 'El residente debe tener al menos un apoderado')
  .max(MAX_GUARDIANS, 'Un residente puede tener máximo 2 apoderados')
  .refine((list) => {
    const ruts = list.map((g) => g.rut).filter(Boolean);
    return new Set(ruts).size === ruts.length;
  }, 'Los dos apoderados no pueden tener el mismo RUT');

const residentFields = {
  first_name: z.string().trim().min(1, 'Ingresa el nombre').max(80),
  last_name: z.string().trim().min(1, 'Ingresa el apellido').max(120),
  rut: z.string().trim().refine(isValidRut, 'RUT inválido').transform(normalizeRut),
  birth_date: isoDate,
  room: z.string().trim().min(1, 'Ingresa la habitación').max(20),
  bed: optionalText(10),
  guardians: guardiansSchema,
};

export const createResidentSchema = z.object({
  ...residentFields,
  is_active: z.boolean().default(true),
});

// PUT = reemplazo completo del recurso
export const updateResidentSchema = z.object({
  ...residentFields,
  is_active: z.boolean({ message: 'Indica el estado' }),
});

export const statusSchema = z.object({
  is_active: z.boolean({ message: 'Indica el estado' }),
});

export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
  sort: z.enum(['name', 'room', 'created']).default('name'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
