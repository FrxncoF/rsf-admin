import { z } from 'zod';
import { AppError } from './AppError.js';

/** Valida `data` contra un schema zod y lanza 400 con el detalle por campo. */
export function parse(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const details = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || '_';
      details[key] ??= issue.message;
    }
    throw AppError.badRequest('Datos inválidos', details);
  }
  return result.data;
}

export const idParamSchema = z.object({
  id: z.string().uuid('Identificador inválido'),
});

export function parseId(params) {
  const result = idParamSchema.safeParse(params);
  if (!result.success) throw AppError.notFound();
  return result.data.id;
}
