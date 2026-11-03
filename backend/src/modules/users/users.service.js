import bcrypt from 'bcryptjs';
import { query } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';

const BCRYPT_ROUNDS = 12;
const PUBLIC_COLUMNS = 'id, email, full_name, role, is_active, last_login_at, created_at, updated_at';

export const hashPassword = (plain) => bcrypt.hash(plain, BCRYPT_ROUNDS);

export function toPublicUser(row) {
  return {
    id: row.id,
    email: row.email,
    full_name: row.full_name,
    role: row.role,
    is_active: row.is_active,
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

export async function listUsers() {
  const { rows } = await query(
    `SELECT ${PUBLIC_COLUMNS} FROM users ORDER BY is_active DESC, role, full_name`,
  );
  return rows.map(toPublicUser);
}

export async function createUser({ email, full_name, role, password }) {
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
  if (changes.password) add('password_hash', await hashPassword(changes.password));

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
