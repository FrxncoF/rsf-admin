import { z } from 'zod';
import { isValidRut, normalizeRut } from '../../utils/rut.js';

export const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null);

// Chile: 9 dígitos después del +56. Acepta "912345678", "+56912345678" o con espacios;
// se guarda siempre como "+56912345678".
export const phoneSchema = z
  .string({ message: 'Ingresa el teléfono' })
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .refine((value) => /^(\+?56)?\d{9}$/.test(value), 'El teléfono debe tener 9 dígitos después del +56')
  .transform((value) => `+56${value.slice(-9)}`);

const optionalRut = z
  .string()
  .trim()
  .nullish()
  .transform((value) => value || null)
  .refine((value) => value === null || isValidRut(value), 'RUT inválido')
  .transform((value) => (value ? normalizeRut(value) : null));

/** Datos propios del apoderado (compartidos entre todos sus residentes). */
export const guardianSchema = z.object({
  full_name: z.string({ message: 'Ingresa el nombre' }).trim().min(2, 'Ingresa el nombre del apoderado').max(160),
  rut: optionalRut,
  phone: phoneSchema,
  email: optionalText(160).refine((value) => value === null || z.string().email().safeParse(value).success, 'Correo inválido'),
  address: optionalText(200),
});

export const guardianListQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});
