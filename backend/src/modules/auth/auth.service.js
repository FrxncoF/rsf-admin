import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { findUserWithHashByEmail, toPublicUser, touchLastLogin, updateUser } from '../users/users.service.js';

// Se compara contra este hash cuando el usuario no existe, para que el tiempo
// de respuesta no revele qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', 12);

export async function authenticate(email, password) {
  const user = await findUserWithHashByEmail(email);
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

  if (!user || !ok) throw AppError.unauthorized('Correo o contraseña incorrectos');
  if (!user.is_active) throw AppError.forbidden('Tu cuenta está desactivada. Contacta a la administración.');

  await touchLastLogin(user.id);
  return toPublicUser(user);
}

export function signAccessToken(user) {
  return jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${env.jwtExpiresHours}h`,
  });
}

export function cookieOptions() {
  return {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: 'strict',
    path: '/',
    maxAge: env.jwtExpiresHours * 60 * 60 * 1000,
  };
}

/** Actualiza el perfil del usuario autenticado (nombre, correo y/o contraseña). */
export async function updateOwnProfile(currentUser, { full_name, email, current_password, new_password }) {
  const emailChanged = email !== undefined && email !== currentUser.email;

  if (emailChanged || new_password) {
    const row = await findUserWithHashByEmail(currentUser.email);
    const ok = current_password && (await bcrypt.compare(current_password, row.password_hash));
    if (!ok) throw AppError.badRequest('La contraseña actual no es correcta', { current_password: 'Contraseña incorrecta' });
  }

  return updateUser(
    currentUser.id,
    { full_name, email: emailChanged ? email : undefined, password: new_password },
    currentUser,
  );
}
