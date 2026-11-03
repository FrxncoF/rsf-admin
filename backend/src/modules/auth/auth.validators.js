import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido'),
  password: z.string().min(1, 'Ingresa tu contraseña').max(128),
});

/** Edición del propio perfil. Cambiar correo o contraseña exige la contraseña actual. */
export const updateProfileSchema = z
  .object({
    full_name: z.string().trim().min(2, 'Ingresa tu nombre').max(120).optional(),
    email: z.string().trim().toLowerCase().email('Correo inválido').max(160).optional(),
    current_password: z.string().max(128).optional(),
    new_password: z.string().min(8, 'Mínimo 8 caracteres').max(128).optional().or(z.literal('').transform(() => undefined)),
  })
  .refine((v) => v.full_name !== undefined || v.email !== undefined || v.new_password !== undefined, {
    message: 'No hay cambios que aplicar',
  });
