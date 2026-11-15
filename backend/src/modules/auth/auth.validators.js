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

// --- Olvidé mi contraseña ---
export const forgotPasswordSchema = z.object({
  email: z.string({ message: 'Ingresa tu correo' }).trim().toLowerCase().email('Correo inválido').max(160),
});

const resetToken = z.string({ message: 'Enlace inválido' }).regex(/^[A-Za-z0-9_-]{40,60}$/, 'Enlace inválido');

export const resetCheckSchema = z.object({ token: resetToken });

export const resetPasswordSchema = z.object({
  token: resetToken,
  password: z.string({ message: 'Ingresa la nueva contraseña' }).min(8, 'Mínimo 8 caracteres').max(128),
});
