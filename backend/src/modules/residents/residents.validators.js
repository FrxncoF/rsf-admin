import { z } from 'zod';
import { isValidRut, normalizeRut } from '../../utils/rut.js';
import { guardianSchema, optionalText } from '../guardians/guardians.validators.js';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (AAAA-MM-DD)')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Fecha inválida')
  .refine((value) => value >= '1900-01-01', 'Fecha demasiado antigua')
  .refine((value) => value <= new Date().toISOString().slice(0, 10), 'La fecha no puede ser futura');

export const MIN_GUARDIANS = 1;
export const MAX_GUARDIANS = 2;

export const DEPENDENCY_LEVELS = ['AUTOVALENTE', 'LEVE', 'MODERADA', 'SEVERA'];

/**
 * Vínculo residente ↔ apoderado. Se elige un apoderado existente (`guardian_id`)
 * o se crea uno nuevo en la misma operación (`guardian`). El parentesco es del vínculo:
 * la misma persona puede ser "Hija" de un residente y "Nuera" de otro.
 */
const guardianLinkSchema = z
  .object({
    guardian_id: z.string().uuid('Apoderado inválido').optional(),
    guardian: guardianSchema.optional(),
    relationship: z.string({ message: 'Indica el parentesco' }).trim().min(1, 'Indica el parentesco').max(40),
  })
  .refine((link) => Boolean(link.guardian_id) !== Boolean(link.guardian), {
    message: 'Selecciona un apoderado existente o ingresa uno nuevo',
  });

// El orden del arreglo define la posición: [0] = principal, [1] = secundario
const guardiansSchema = z
  .array(guardianLinkSchema, { message: 'Ingresa los apoderados' })
  .min(MIN_GUARDIANS, 'El residente debe tener al menos un apoderado')
  .max(MAX_GUARDIANS, 'Un residente puede tener máximo 2 apoderados')
  .refine((list) => {
    const ids = list.map((g) => g.guardian_id).filter(Boolean);
    return new Set(ids).size === ids.length;
  }, 'No puedes asignar el mismo apoderado dos veces')
  .refine((list) => {
    const ruts = list.map((g) => g.guardian?.rut).filter(Boolean);
    return new Set(ruts).size === ruts.length;
  }, 'Los dos apoderados no pueden tener el mismo RUT');

// Acepta 12.5, "12,5" o "12.50"; máximo 2 decimales
const ufAmount = z
  .union([z.number(), z.string().trim().transform((v) => v.replace(',', '.'))])
  .refine((v) => v !== '' && /^\d{1,5}(\.\d{1,2})?$/.test(String(v)), 'Monto inválido (máx. 2 decimales)')
  .transform(Number)
  .refine((v) => v > 0, 'Debe ser mayor a 0')
  .refine((v) => v < 1000, 'Monto demasiado alto');

const residentFields = {
  first_name: z.string().trim().min(1, 'Ingresa el nombre').max(80),
  last_name: z.string().trim().min(1, 'Ingresa el apellido').max(120),
  rut: z.string().trim().refine(isValidRut, 'RUT inválido').transform(normalizeRut),
  birth_date: isoDate,
  site_id: z.coerce.number({ message: 'Selecciona la sede' }).int().positive('Selecciona la sede'),
  room: z.string().trim().min(1, 'Ingresa la habitación').max(20),
  bed: optionalText(10),
  admission_date: isoDate,
  dependency_level: z.enum(DEPENDENCY_LEVELS, { message: 'Selecciona el nivel de dependencia' }),
  monthly_fee_uf: ufAmount,
  payment_due_day: z.coerce
    .number({ message: 'Indica el día de pago' })
    .int('Indica el día de pago')
    .min(1, 'Entre 1 y 31')
    .max(31, 'Entre 1 y 31'),
  guardians: guardiansSchema,
};

const admissionAfterBirth = (r) => r.admission_date >= r.birth_date;
const admissionIssue = { message: 'El ingreso no puede ser antes del nacimiento', path: ['admission_date'] };

export const createResidentSchema = z
  .object({
    ...residentFields,
    is_active: z.boolean().default(true),
  })
  .refine(admissionAfterBirth, admissionIssue);

// PUT = reemplazo completo del recurso
export const updateResidentSchema = z
  .object({
    ...residentFields,
    is_active: z.boolean({ message: 'Indica el estado' }),
  })
  .refine(admissionAfterBirth, admissionIssue);

export const statusSchema = z.object({
  is_active: z.boolean({ message: 'Indica el estado' }),
});

export const listQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  site_id: z.coerce.number().int().positive().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('active'),
  sort: z.enum(['name', 'room', 'created']).default('name'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(25),
});
