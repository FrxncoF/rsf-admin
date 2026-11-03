import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Correo inválido').max(160);
const fullName = z.string().trim().min(2, 'Ingresa el nombre').max(120);
const role = z.enum(['ADMIN', 'CUIDADORA'], { message: 'Rol inválido' });
const password = z.string().min(8, 'Mínimo 8 caracteres').max(128);

export const createUserSchema = z.object({
  email,
  full_name: fullName,
  role,
  password,
});

export const updateUserSchema = z.object({
  email: email.optional(),
  full_name: fullName.optional(),
  role: role.optional(),
  is_active: z.boolean().optional(),
  password: password.optional().or(z.literal('').transform(() => undefined)),
});
