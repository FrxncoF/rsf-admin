import bcrypt from 'bcryptjs';
import { query } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';

const BCRYPT_ROUNDS = 12;
const PUBLIC_COLUMNS =
  'id, email, full_name, role, is_active, must_change_password, token_version, last_login_at, created_at, updated_at';
const SUPPORT = 'SOPORTE';
const isSupport = (user) => user?.role === SUPPORT;

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

export function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
    must_change_password: row.must_change_password,
    last_login_at: row.last_login_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function findUserById(id) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS} FROM users WHERE id = $1`, [id]);
  return rows[0] ?? null;
}

export async function findUserWithHashByEmail(email) {
  const { rows } = await query(`SELECT ${PUBLIC_COLUMNS}, password_hash FROM users WHERE email = $1`, [email]);
  return rows[0] ?? null;
}

export async function touchLastLogin(id) {
  await query('UPDATE users SET last_login_at = now() WHERE id = $1', [id]);
}

/** Un ADMIN no ve las cuentas SOPORTE; SOPORTE ve todas. */
export async function listUsers(actingUser) {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users
      ${isSupport(actingUser) ? '' : `WHERE role <> '${SUPPORT}'`}
      ORDER BY is_active DESC, role, full_name`,
  );
  return rows.map(toPublicUser);
}

/** Lanza 404 si el usuario no existe o si un ADMIN intenta administrar una cuenta SOPORTE. */
export async function assertManageable(id, actingUser) {
  const target = await findUserById(id);
  if (!target || (target.role === SUPPORT && !isSupport(actingUser))) throw AppError.notFound('Usuario no encontrado');
  return target;
}

export async function createUser({ email, full_name, role, password }, actingUser = null) {
  if (role === SUPPORT && actingUser && !isSupport(actingUser)) throw AppError.forbidden('Solo soporte puede crear cuentas de soporte');
  const passwordHash = await hashPassword(password);
  const { rows } = await query(
    `INSERT INTO users (email, full_name, role, password_hash)
     VALUES ($1, $2, $3, $4)
     RETURNING ${PUBLIC_COLUMNS}`,
    [email, full_name, role, passwordHash],
  );
  return toPublicUser(rows[0]);
}

export async function updateUser(id, changes, actingUser) {
  if (id !== actingUser.id) await assertManageable(id, actingUser);
  if (changes.role === SUPPORT && !isSupport(actingUser)) throw AppError.forbidden('Solo soporte puede asignar el rol soporte');
  if (id === actingUser.id) {
    if (changes.is_active === false) throw AppError.badRequest('No puedes desactivar tu propia cuenta');
    if (changes.role && changes.role !== actingUser.role) throw AppError.badRequest('No puedes cambiar tu propio rol');
  }

  const sets = [];
  const params = [];
  const add = (column, value) => {
    params.push(value);
    sets.push(`${column} = $${params.length}`);
  };

  if (changes.full_name !== undefined) add('full_name', changes.full_name);
  if (changes.email !== undefined) add('email', changes.email);
  if (changes.role !== undefined) add('role', changes.role);
  if (changes.is_active !== undefined) add('is_active', changes.is_active);
  if (changes.password) {
    add('password_hash', await hashPassword(changes.password));
    // Al cambiar su propia clave deja de ser temporal
    if (id === actingUser.id) add('must_change_password', false);
  }

  if (sets.length === 0) throw AppError.badRequest('No hay cambios que aplicar');

  params.push(id);
  const { rows } = await query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${PUBLIC_COLUMNS}`,
    params,
  );
  if (!rows[0]) throw AppError.notFound('Usuario no encontrado');
  return toPublicUser(rows[0]);
}

/** Crea el ADMIN inicial desde variables de entorno si todavía no existe ninguno. */
export async function ensureInitialAdmin({ email, password, name }) {
  const { rows } = await query(`SELECT 1 FROM users WHERE role = 'ADMIN' LIMIT 1`);
  if (rows.length > 0) return;

  if (!email || !password) {
    console.warn('[bootstrap] No existe ningún ADMIN y faltan ADMIN_EMAIL / ADMIN_PASSWORD. No se pudo crear.');
    return;
  }
  if (password.length < 8) {
    console.warn('[bootstrap] ADMIN_PASSWORD debe tener al menos 8 caracteres. No se creó el ADMIN.');
    return;
  }

  await createUser({ email, full_name: name, role: 'ADMIN', password });
  console.log(`[bootstrap] Usuario ADMIN inicial creado: ${email}`);
}

/** Crea la cuenta SOPORTE inicial desde variables de entorno si todavía no existe ninguna. */
export async function ensureInitialSupport({ email, password, name }) {
  if (!email || !password) return;
  const { rows } = await query(`SELECT 1 FROM users WHERE role = '${SUPPORT}' LIMIT 1`);
  if (rows.length > 0) return;
  if (password.length < 8) {
    console.warn('[bootstrap] SUPPORT_PASSWORD debe tener al menos 8 caracteres. No se creó la cuenta de soporte.');
    return;
  }
  const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing[0]) {
    // El correo ya existe (ej. tu cuenta ADMIN): se promueve a SOPORTE sin tocar su clave
    await query(`UPDATE users SET role = '${SUPPORT}' WHERE id = $1`, [existing[0].id]);
    console.log(`[bootstrap] Cuenta existente promovida a SOPORTE: ${email}`);
    return;
  }
  await createUser({ email, full_name: name, role: SUPPORT, password });
  console.log(`[bootstrap] Usuario SOPORTE inicial creado: ${email}`);
}

/** Clave temporal: el usuario debe cambiarla al entrar. Cierra sus sesiones abiertas. */
export async function resetPassword(id, actingUser) {
  await assertManageable(id, actingUser);
  if (id === actingUser.id) throw AppError.badRequest('Para tu propia cuenta usa Configuración');
  const temporary = generateTemporaryPassword();
  await query(
    `UPDATE users SET password_hash = $1, must_change_password = TRUE, token_version = token_version + 1 WHERE id = $2`,
    [await hashPassword(temporary), id],
  );
  return temporary;
}

/** Invalida todos los tokens emitidos al usuario (perdió el celular, sospecha de acceso, etc.). */
export async function revokeSessions(id, actingUser) {
  await assertManageable(id, actingUser);
  await query('UPDATE users SET token_version = token_version + 1 WHERE id = $1', [id]);
}

// Sin caracteres ambiguos (0/O, 1/l/I) para dictarla por teléfono
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
function generateTemporaryPassword(length = 10) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}
