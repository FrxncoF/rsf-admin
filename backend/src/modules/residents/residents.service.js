import fs from 'node:fs/promises';
import path from 'node:path';
import { query, withTransaction } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { cleanRut } from '../../utils/rut.js';

// Apoderados como arreglo JSON ordenado por posición (1 = principal)
const guardiansJson = (fields) => `
  COALESCE((
    SELECT json_agg(json_build_object(${fields.map((f) => `'${f}', g.${f}`).join(', ')}) ORDER BY g.position)
    FROM resident_guardians g WHERE g.resident_id = r.id
  ), '[]'::json) AS guardians`;

// Columnas que ve cada rol. La cuidadora no necesita RUT ni metadatos de gestión;
// de los apoderados solo ve nombre, parentesco y teléfono (para emergencias).
const ADMIN_COLUMNS = `
  r.id, r.first_name, r.last_name, r.rut, r.birth_date, r.room, r.bed, r.is_active,
  (r.photo_path IS NOT NULL) AS has_photo, r.created_at, r.updated_at,
  ${guardiansJson(['id', 'position', 'full_name', 'rut', 'relationship', 'phone', 'email', 'address'])}`;

const CAREGIVER_COLUMNS = `
  r.id, r.first_name, r.last_name, r.birth_date, r.room, r.bed, r.is_active,
  (r.photo_path IS NOT NULL) AS has_photo, r.updated_at`;

const CAREGIVER_DETAIL_COLUMNS = `${CAREGIVER_COLUMNS},
  ${guardiansJson(['id', 'position', 'full_name', 'relationship', 'phone'])}`;

async function replaceGuardians(client, residentId, guardians) {
  await client.query('DELETE FROM resident_guardians WHERE resident_id = $1', [residentId]);
  for (const [index, g] of guardians.entries()) {
    await client.query(
      `INSERT INTO resident_guardians (resident_id, position, full_name, rut, relationship, phone, email, address)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [residentId, index + 1, g.full_name, g.rut, g.relationship, g.phone, g.email, g.address],
    );
  }
}

const SORTS = {
  name: 'r.last_name, r.first_name',
  room: 'r.room, r.bed NULLS LAST, r.last_name',
  created: 'r.created_at DESC',
};

const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listResidents({ search, status, sort, page, pageSize }, { isAdmin }) {
  const where = [];
  const params = [];

  // La cuidadora solo ve residentes activos
  const effectiveStatus = isAdmin ? status : 'active';
  if (effectiveStatus === 'active') where.push('r.is_active = TRUE');
  if (effectiveStatus === 'inactive') where.push('r.is_active = FALSE');

  if (search) {
    params.push(`%${escapeLike(search.toLowerCase())}%`);
    const textIdx = params.length;
    const conditions = [
      `lower(r.first_name || ' ' || r.last_name) LIKE $${textIdx}`,
      `lower(r.room) LIKE $${textIdx}`,
    ];
    const rutDigits = cleanRut(search);
    if (isAdmin && /^\d{3,}/.test(rutDigits)) {
      params.push(`%${rutDigits}%`);
      conditions.push(`replace(r.rut, '-', '') LIKE $${params.length}`);
    }
    where.push(`(${conditions.join(' OR ')})`);
  }

  params.push(pageSize, (page - 1) * pageSize);
  const sql = `
    SELECT ${isAdmin ? ADMIN_COLUMNS : CAREGIVER_COLUMNS}, COUNT(*) OVER() AS total_count
    FROM residents r
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${SORTS[sort]}
    LIMIT $${params.length - 1} OFFSET $${params.length}`;

  const { rows } = await query(sql, params);
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    data: rows.map(({ total_count: _t, ...row }) => row),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getResident(id, { isAdmin }) {
  const { rows } = await query(
    `SELECT ${isAdmin ? ADMIN_COLUMNS : CAREGIVER_DETAIL_COLUMNS} FROM residents r WHERE r.id = $1`,
    [id],
  );
  const resident = rows[0];
  if (!resident || (!isAdmin && !resident.is_active)) throw AppError.notFound('Residente no encontrado');
  return resident;
}

export async function createResident(input, userId) {
  const id = await withTransaction(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO residents (first_name, last_name, rut, birth_date, room, bed, is_active, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
       RETURNING id`,
      [input.first_name, input.last_name, input.rut, input.birth_date, input.room, input.bed, input.is_active, userId],
    );
    await replaceGuardians(client, rows[0].id, input.guardians);
    return rows[0].id;
  });
  return getResident(id, { isAdmin: true });
}

export async function updateResident(id, input, userId) {
  await withTransaction(async (client) => {
    const { rowCount } = await client.query(
      `UPDATE residents
          SET first_name = $1, last_name = $2, rut = $3, birth_date = $4,
              room = $5, bed = $6, is_active = $7, updated_by = $8
        WHERE id = $9`,
      [input.first_name, input.last_name, input.rut, input.birth_date, input.room, input.bed, input.is_active, userId, id],
    );
    if (rowCount === 0) throw AppError.notFound('Residente no encontrado');
    await replaceGuardians(client, id, input.guardians);
  });
  return getResident(id, { isAdmin: true });
}

export async function setResidentStatus(id, isActive, userId) {
  const { rowCount } = await query(
    'UPDATE residents SET is_active = $1, updated_by = $2 WHERE id = $3',
    [isActive, userId, id],
  );
  if (rowCount === 0) throw AppError.notFound('Residente no encontrado');
  return getResident(id, { isAdmin: true });
}

export async function deleteResident(id) {
  const { rows } = await query('DELETE FROM residents WHERE id = $1 RETURNING photo_path', [id]);
  if (!rows[0]) throw AppError.notFound('Residente no encontrado');
  await removePhotoFile(rows[0].photo_path);
}

// ---------------------------------------------------------------------
// Fotos
// ---------------------------------------------------------------------

const photoDir = () => path.join(env.uploadDir, 'residents');

/** Detecta el tipo real por "magic bytes" (no confiamos en el mimetype del cliente). */
function detectImageType(buffer) {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpg';
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

async function removePhotoFile(fileName) {
  if (!fileName) return;
  await fs.rm(path.join(photoDir(), path.basename(fileName)), { force: true });
}

export async function savePhoto(id, file, userId) {
  if (!file) throw AppError.badRequest('Adjunta una imagen en el campo "photo"');
  const ext = detectImageType(file.buffer);
  if (!ext) throw AppError.badRequest('Formato no soportado. Usa JPG, PNG o WEBP');

  const { rows } = await query('SELECT photo_path FROM residents WHERE id = $1', [id]);
  if (!rows[0]) throw AppError.notFound('Residente no encontrado');

  await fs.mkdir(photoDir(), { recursive: true });
  const fileName = `${id}-${Date.now()}.${ext}`;
  await fs.writeFile(path.join(photoDir(), fileName), file.buffer);

  await query('UPDATE residents SET photo_path = $1, updated_by = $2 WHERE id = $3', [fileName, userId, id]);
  await removePhotoFile(rows[0].photo_path);
  return getResident(id, { isAdmin: true });
}

export async function deletePhoto(id, userId) {
  const { rows } = await query('SELECT photo_path FROM residents WHERE id = $1', [id]);
  if (!rows[0]) throw AppError.notFound('Residente no encontrado');
  await query('UPDATE residents SET photo_path = NULL, updated_by = $1 WHERE id = $2', [userId, id]);
  await removePhotoFile(rows[0].photo_path);
  return getResident(id, { isAdmin: true });
}

export async function getPhotoPath(id, { isAdmin }) {
  const { rows } = await query('SELECT photo_path, is_active FROM residents WHERE id = $1', [id]);
  const row = rows[0];
  if (!row?.photo_path || (!isAdmin && !row.is_active)) throw AppError.notFound('Foto no encontrada');
  return path.join(photoDir(), path.basename(row.photo_path));
}
