import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { query } from '../../db/pool.js';
import { findUserWithHashByEmail, toPublicUser, touchLastLogin, updateUser } from '../users/users.service.js';

// Se compara contra este hash cuando el usuario no existe, para que el tiempo
// de respuesta no revele qué correos están registrados.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', 12);

// Bloqueo por cuenta: frena a quien prueba claves de un mismo correo desde muchas IPs
const LOCK_ATTEMPTS = 10;
const LOCK_MINUTES = 15;

/** Intentos fallidos del correo en los últimos 15 min, sin contar los anteriores a su último ingreso correcto. */
async function recentFailures(email) {
  const { rows } = await query(
    `SELECT count(*)::int AS n FROM login_events
      WHERE lower(email) = lower($1) AND success = FALSE AND reason = 'bad_credentials'
        AND created_at > GREATEST(
          now() - make_interval(mins => $2),
          COALESCE((SELECT max(created_at) FROM login_events WHERE lower(email) = lower($1) AND success), '-infinity'))`,
    [email, LOCK_MINUTES],
  );
  return rows[0].n;
}

export async function authenticate(email, password, meta = {}) {
  if ((await recentFailures(email)) >= LOCK_ATTEMPTS) {
    await recordLogin({ email, success: false, reason: 'locked', ...meta });
    throw new AppError(429, `Demasiados intentos con este correo. Intenta nuevamente en ${LOCK_MINUTES} minutos.`);
  }

  const user = await findUserWithHashByEmail(email);
  const ok = await bcrypt.compare(password, user?.password_hash ?? DUMMY_HASH);

  if (!user || !ok) {
    await recordLogin({ email, userId: user?.id, success: false, reason: 'bad_credentials', ...meta });
    throw AppError.unauthorized('Correo o contraseña incorrectos');
  }
  if (!user.is_active) {
    await recordLogin({ email, userId: user.id, success: false, reason: 'inactive', ...meta });
    throw AppError.forbidden('Tu cuenta está desactivada. Contacta a la administración.');
  }

  await touchLastLogin(user.id);
  await recordLogin({ email, userId: user.id, success: true, reason: 'ok', ...meta });
  return { user: toPublicUser(user), tokenVersion: user.token_version };
}

/** Historial de accesos (sección Soporte). Nunca hace fallar el login. */
export async function recordLogin({ email, userId = null, success, reason, ip = null, userAgent = null }) {
  await query(
    'INSERT INTO login_events (email, user_id, success, reason, ip, user_agent) VALUES ($1, $2, $3, $4, $5, $6)',
    [email?.slice(0, 160) ?? null, userId, success, reason, ip, userAgent?.slice(0, 300) ?? null],
  ).catch((err) => console.warn('[auth] no se pudo registrar el acceso:', err.message));
}

export function signAccessToken(user, tokenVersion = 0) {
  // jti: identificador único, permite invalidar esta sesión al salir
  return jwt.sign({ sub: user.id, role: user.role, tv: tokenVersion, jti: randomUUID() }, env.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: `${env.jwtExpiresHours}h`,
  });
}

/** Invalida el token de la sesión actual (logout). Un token inválido o ya vencido se ignora. */
export async function revokeToken(token) {
  if (!token) return;
  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] });
  } catch {
    return;
  }
  if (!payload.jti || !payload.exp) return;
  await query('INSERT INTO revoked_tokens (jti, expires_at) VALUES ($1, to_timestamp($2)) ON CONFLICT DO NOTHING', [
    payload.jti,
    payload.exp,
  ]);
}

export async function isTokenRevoked(jti) {
  if (!jti) return false;
  const { rowCount } = await query('SELECT 1 FROM revoked_tokens WHERE jti = $1', [jti]);
  return rowCount > 0;
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

  const updated = await updateUser(
    currentUser.id,
    { full_name, email: emailChanged ? email : undefined, password: new_password },
    currentUser,
  );
  if (new_password) await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [currentUser.id]);
  return updated;
}
