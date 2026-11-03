import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { findUserById, toPublicUser } from '../modules/users/users.service.js';

export const ROLES = Object.freeze({ ADMIN: 'ADMIN', CUIDADORA: 'CUIDADORA' });

function extractToken(req) {
  const fromCookie = req.cookies?.[env.cookieName];
  if (fromCookie) return fromCookie;
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  return scheme === 'Bearer' && token ? token : null;
}

/**
 * Verifica el JWT (cookie httpOnly o header Authorization: Bearer) y carga el
 * usuario desde la BD, así una cuenta desactivada pierde el acceso de inmediato.
 */
export async function verifyToken(req, _res, next) {
  const token = extractToken(req);
  if (!token) throw AppError.unauthorized();

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    throw AppError.unauthorized('Sesión inválida o expirada');
  }

  const user = await findUserById(payload.sub);
  if (!user || !user.is_active) throw AppError.unauthorized('Usuario no autorizado');

  req.user = toPublicUser(user);
  next();
}

/** Uso: router.post('/', verifyToken, verifyRole(['ADMIN']), handler) */
export function verifyRole(allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) throw AppError.unauthorized();
    if (!allowedRoles.includes(req.user.role)) throw AppError.forbidden();
    next();
  };
}
