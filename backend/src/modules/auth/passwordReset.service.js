import { createHash, randomBytes } from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { emailLayout, sendMail } from '../../utils/mailer.js';
import { hashPassword } from '../users/users.service.js';
import { recordLogin } from './auth.service.js';

const TOKEN_MINUTES = 30;
// Máximo de correos de recuperación por cuenta en una hora (evita "bombardear" a alguien)
const MAX_PER_HOUR = 3;

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

/**
 * Pide el enlace de recuperación. Responde siempre igual (exista o no el correo) para no
 * revelar qué cuentas existen; el trabajo real ocurre en segundo plano.
 */
export async function requestPasswordReset(email, { ip, userAgent }) {
  const { rows } = await query('SELECT id, full_name, email, is_active FROM users WHERE lower(email) = lower($1)', [email]);
  const user = rows[0];
  if (!user || !user.is_active) {
    await recordLogin({ email, userId: user?.id, success: false, reason: 'reset_unknown', ip, userAgent });
    return;
  }

  const { rows: recent } = await query(
    `SELECT count(*)::int AS n FROM password_resets WHERE user_id = $1 AND created_at > now() - interval '1 hour'`,
    [user.id],
  );
  if (recent[0].n >= MAX_PER_HOUR) {
    await recordLogin({ email, userId: user.id, success: false, reason: 'reset_limited', ip, userAgent });
    return;
  }

  const token = randomBytes(32).toString('base64url');
  await withTransaction(async (client) => {
    // Solo vale el último enlace pedido
    await client.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [user.id]);
    await client.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at, ip) VALUES ($1, $2, now() + make_interval(mins => $3), $4)`,
      [user.id, sha256(token), TOKEN_MINUTES, ip],
    );
  });

  const url = `${env.appUrl}/restablecer-contrasena?token=${token}`;
  const firstName = user.full_name.split(' ')[0];
  try {
    await sendMail({
      to: user.email,
      subject: 'Restablecer tu contraseña · Residencia San Francisco',
      text: [
        `Hola ${firstName}:`,
        '',
        'Recibimos una solicitud para restablecer tu contraseña del sistema de la residencia.',
        `Para elegir una nueva, abre este enlace (vence en ${TOKEN_MINUTES} minutos y sirve una sola vez):`,
        '',
        url,
        '',
        'Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.',
      ].join('\n'),
      html: emailLayout({
        title: 'Restablecer tu contraseña',
        intro: `Hola ${escapeHtml(firstName)}: recibimos una solicitud para restablecer tu contraseña del sistema de la residencia.`,
        buttonText: 'Elegir nueva contraseña',
        buttonUrl: url,
        footer: `El enlace vence en ${TOKEN_MINUTES} minutos y sirve una sola vez. Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.`,
      }),
    });
    await recordLogin({ email: user.email, userId: user.id, success: true, reason: 'reset_requested', ip, userAgent });
  } catch (err) {
    console.error('[correo] no se pudo enviar el restablecimiento:', err.message);
    await recordLogin({ email: user.email, userId: user.id, success: false, reason: 'reset_mail_error', ip, userAgent });
  }
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

async function findValidReset(token, db = { query }) {
  const { rows } = await db.query(
    `SELECT r.id, r.user_id, u.email, u.is_active
       FROM password_resets r JOIN users u ON u.id = r.user_id
      WHERE r.token_hash = $1 AND r.used_at IS NULL AND r.expires_at > now()`,
    [sha256(token)],
  );
  return rows[0]?.is_active ? rows[0] : null;
}

/** ¿El enlace sigue vigente? (para mostrar el formulario o un aviso de enlace vencido) */
export async function checkResetToken(token) {
  return { valid: Boolean(await findValidReset(token)) };
}

/** Cambia la clave con un enlace vigente. Cierra todas las sesiones abiertas de la cuenta. */
export async function resetPassword(token, password, { ip, userAgent }) {
  const hash = await hashPassword(password);
  const reset = await withTransaction(async (client) => {
    const r = await findValidReset(token, client);
    if (!r) return null;
    const { rowCount } = await client.query('UPDATE password_resets SET used_at = now() WHERE id = $1 AND used_at IS NULL', [r.id]);
    if (!rowCount) return null; // otro pedido lo usó al mismo tiempo
    await client.query(
      `UPDATE users SET password_hash = $1, must_change_password = FALSE, token_version = token_version + 1 WHERE id = $2`,
      [hash, r.user_id],
    );
    await client.query('UPDATE password_resets SET used_at = now() WHERE user_id = $1 AND used_at IS NULL', [r.user_id]);
    return r;
  });
  if (!reset) throw AppError.badRequest('El enlace venció o ya fue usado. Pide uno nuevo.');
  await recordLogin({ email: reset.email, userId: reset.user_id, success: true, reason: 'password_reset', ip, userAgent });
}

/** Limpieza diaria: enlaces vencidos de más de 7 días. */
export async function pruneResets() {
  await query(`DELETE FROM password_resets WHERE expires_at < now() - interval '7 days'`);
}
