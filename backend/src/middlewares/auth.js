import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { findUserById, toPublicUser } from '../modules/users/users.service.js';
import { isTokenRevoked } from '../modules/auth/auth.service.js';

export const ROLES = Object.freeze({ ADMIN: 'ADMIN', CUIDADORA: 'CUIDADORA', SOPORTE: 'SOPORTE' });

/** SOPORTE puede todo lo que puede un ADMIN. */
export const hasAdminAccess = (user) => user?.role === ROLES.ADMIN || user?.role === ROLES.SOPORTE;

/**
 * Verifica el JWT de la cookie httpOnly (JavaScript no puede leerla) y carga el
 * usuario desde la BD, así una cuenta desactivada pierde el acceso de inmediato.
 * `tv` (token_version) permite cerrar todas las sesiones de un usuario;
 * `jti` revocado = sesión cerrada con "Salir".
 */
export async function verifyToken(req, _res, next) {
  const token = req.cookies?.[env.cookieName];
  if (!token) throw AppError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw AppError.unauthorized('Sesión inválida o expirada');
  }

  if (await isTokenRevoked(payload.jti)) throw AppError.unauthorized('Sesión cerrada. Ingresa nuevamente.');

  const user = await findUserById(payload.sub);
  if (!user || !user.is_active) throw AppError.unauthorized('Usuario no autorizado');
  if ((payload.tv ?? 0) !== user.token_version) throw AppError.unauthorized('Tu sesión fue cerrada. Ingresa nuevamente.');

  // Con clave temporal solo se permite usar /api/auth (ver perfil, cambiar clave, salir)
  if (user.must_change_password && !req.originalUrl.startsWith('/api/auth/')) {
    throw AppError.forbidden('Debes cambiar tu contraseña antes de continuar');
  }

  req.user = toPublicUser(user);
  next();
}

/**
 * Uso: router.post('/', verifyToken, verifyRole(['ADMIN']), handler).
 * Donde se permite ADMIN también se permite SOPORTE.
 */
export function verifyRole(allowedRoles) {
  const allowed = allowedRoles.includes(ROLES.ADMIN) ? [...allowedRoles, ROLES.SOPORTE] : allowedRoles;
  return (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!allowed.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
}
