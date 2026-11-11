import fs from 'node:fs/promises';
import path from 'node:path';
import { query, withTransaction } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';
import { cleanRut } from '../../utils/rut.js';
import { escapeLike } from '../../utils/sql.js';
import { insertGuardian } from '../guardians/guardians.service.js';
import { assertCatalogValue } from '../settings/settings.service.js';

// Apoderados como arreglo JSON ordenado por posición (1 = principal).
// `id` es el del apoderado (guardians.id); parentesco y posición vienen del vínculo.
const GUARDIAN_FIELDS = {
  id: 'g.id',
  position: 'rg.position',
  relationship: 'rg.relationship',
  full_name: 'g.full_name',
  rut: 'g.rut',
  phone: 'g.phone',
  email: 'g.email',
  address: 'g.address',
};

const guardiansJson = (fields) => `
  COALESCE((
    SELECT json_agg(json_build_object(${fields.map((f) => `'${f}', ${GUARDIAN_FIELDS[f]}`).join(', ')}) ORDER BY rg.position)
    FROM resident_guardians rg JOIN guardians g ON g.id = rg.guardian_id
    WHERE rg.resident_id = r.id
  ), '[]'::json) AS guardians`;

// Columnas que ve cada rol. La cuidadora no necesita RUT, datos de pago ni metadatos;
// de los apoderados solo ve nombre, parentesco y teléfono (para emergencias).
const BASE_COLUMNS = `
  r.id, r.first_name, r.last_name, r.birth_date, r.site_id, s.name AS site_name, r.room, r.bed,
  r.admission_date, r.dependency_level, r.cognitive_level, r.pressure_risk,
  r.health_system, r.isapre, r.ambulance, r.has_cesfam, r.care_place, r.is_active, (r.photo_path IS NOT NULL) AS has_photo, r.updated_at`;

const ADMIN_COLUMNS = `${BASE_COLUMNS},
  r.rut, r.monthly_fee_uf::float8 AS monthly_fee_uf, r.payment_due_day, r.created_at,
  ${guardiansJson(['id', 'position', 'relationship', 'full_name', 'rut', 'phone', 'email', 'address'])}`;

const CAREGIVER_COLUMNS = BASE_COLUMNS;

// Patologías y medicamentos: visibles para ambos roles en el detalle
const CLINICAL_COLUMNS = `
  COALESCE((
    SELECT json_agg(json_build_object('id', c.id, 'name', c.name) ORDER BY lower(c.name))
    FROM resident_conditions c WHERE c.resident_id = r.id
  ), '[]'::json) AS conditions,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', m.id, 'name', m.name, 'dose', m.dose, 'schedule', m.schedule, 'instructions', m.instructions
    ) ORDER BY lower(m.name))
    FROM resident_medications m WHERE m.resident_id = r.id
  ), '[]'::json) AS medications`;

const ADMIN_DETAIL_COLUMNS = `${ADMIN_COLUMNS}, ${CLINICAL_COLUMNS}`;

const CAREGIVER_DETAIL_COLUMNS = `${CAREGIVER_COLUMNS},
  ${guardiansJson(['id', 'position', 'relationship', 'full_name', 'phone'])}, ${CLINICAL_COLUMNS}`;

const FROM = 'FROM residents r JOIN sites s ON s.id = r.site_id';

async function replaceGuardians(client, residentId, links, userId) {
  // Un apoderado desactivado no se puede asignar de nuevo (sí se conserva si ya estaba vinculado)
  const newIds = links.map((l) => l.guardian_id).filter(Boolean);
  if (newIds.length) {
    const { rows } = await client.query(
      `SELECT g.full_name FROM guardians g
        WHERE g.id = ANY($1::uuid[]) AND NOT g.is_active
          AND NOT EXISTS (SELECT 1 FROM resident_guardians rg WHERE rg.guardian_id = g.id AND rg.resident_id = $2)`,
      [newIds, residentId],
    );
    if (rows[0]) throw AppError.badRequest(`${rows[0].full_name} está desactivado: reactívalo desde Apoderados`);
  }
  // Las filas de vínculo sí se reemplazan (no son registros de personas)
  await client.query('DELETE FROM resident_guardians WHERE resident_id = $1', [residentId]);
  for (const [index, link] of links.entries()) {
    const guardianId = link.guardian_id ?? (await insertGuardian(link.guardian, userId, client));
    await client.query(
      'INSERT INTO resident_guardians (resident_id, guardian_id, position, relationship) VALUES ($1, $2, $3, $4)',
      [residentId, guardianId, index + 1, link.relationship],
    );
  }
}

const SORTS = {
  name: 'r.last_name, r.first_name',
  room: 's.name, r.room, r.bed NULLS LAST, r.last_name',
  created: 'r.created_at DESC',
};

export async function listResidents({ search, site_id: siteId, status, sort, page, pageSize }, { isAdmin }) {
  const where = [];
  const params = [];

  // La cuidadora solo ve residentes activos
  const effectiveStatus = isAdmin ? status : 'active';
  if (effectiveStatus === 'active') where.push('r.is_active = TRUE');
  if (effectiveStatus === 'inactive') where.push('r.is_active = FALSE');

  if (siteId) {
    params.push(siteId);
    where.push(`r.site_id = $${params.length}`);
  }

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
    ${FROM}
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
    `SELECT ${isAdmin ? ADMIN_DETAIL_COLUMNS : CAREGIVER_DETAIL_COLUMNS} ${FROM} WHERE r.id = $1`,
    [id],
  );
  const resident = rows[0];
  if (!resident || (!isAdmin && !resident.is_active)) throw AppError.notFound('Residente no encontrado');
  return resident;
}

// Orden de columnas compartido por INSERT y UPDATE
const RESIDENT_COLUMNS = [
  'first_name', 'last_name', 'rut', 'birth_date', 'site_id', 'room', 'bed',
  'admission_date', 'dependency_level', 'monthly_fee_uf', 'payment_due_day',
  'cognitive_level', 'pressure_risk', 'health_system', 'isapre', 'ambulance', 'has_cesfam', 'care_place', 'is_active',
];
const residentValues = (input) => RESIDENT_COLUMNS.map((c) => input[c]);

/** Isapre y ambulancia deben existir en los catálogos (se permite conservar un valor ya desactivado). */
async function assertCatalogs(input, current = {}) {
  await assertCatalogValue('isapres', input.isapre, { current: current.isapre, field: 'isapre', label: 'la isapre' });
  await assertCatalogValue('ambulances', input.ambulance, { current: current.ambulance, field: 'ambulance', label: 'la ambulancia' });
}

export async function createResident(input, userId) {
  await assertCatalogs(input);
  const id = await withTransaction(async (client) => {
    const n = RESIDENT_COLUMNS.length;
    const { rows } = await client.query(
      `INSERT INTO residents (${RESIDENT_COLUMNS.join(', ')}, created_by, updated_by)
       VALUES (${RESIDENT_COLUMNS.map((_, i) => `$${i + 1}`).join(', ')}, $${n + 1}, $${n + 1})
       RETURNING id`,
      [...residentValues(input), userId],
    );
    await replaceGuardians(client, rows[0].id, input.guardians, userId);
    return rows[0].id;
  });
  return getResident(id, { isAdmin: true });
}

export async function updateResident(id, input, userId) {
  const { rows: currentRows } = await query('SELECT isapre, ambulance FROM residents WHERE id = $1', [id]);
  await assertCatalogs(input, currentRows[0]);
  await withTransaction(async (client) => {
    const n = RESIDENT_COLUMNS.length;
    const { rowCount } = await client.query(
      `UPDATE residents
          SET ${RESIDENT_COLUMNS.map((c, i) => `${c} = $${i + 1}`).join(', ')}, updated_by = $${n + 1}
        WHERE id = $${n + 2}`,
      [...residentValues(input), userId, id],
    );
    if (rowCount === 0) throw AppError.notFound('Residente no encontrado');
    await replaceGuardians(client, id, input.guardians, userId);
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
  const filePath = path.join(photoDir(), path.basename(row.photo_path));
  // La BD puede apuntar a un archivo que no está en este servidor (ej. base restaurada sin
  // copiar el volumen de fotos): 404 para que la app muestre las iniciales, no un error 500.
  try {
    await fs.access(filePath);
  } catch {
    throw AppError.notFound('Foto no encontrada');
  }
  return filePath;
}

// ---------------------------------------------------------------------
// Patologías y medicamentos (ADMIN)
// ---------------------------------------------------------------------

async function assertResident(id) {
  const { rowCount } = await query('SELECT 1 FROM residents WHERE id = $1', [id]);
  if (rowCount === 0) throw AppError.notFound('Residente no encontrado');
}

export async function addCondition(residentId, { name }, userId) {
  await assertResident(residentId);
  await query('INSERT INTO resident_conditions (resident_id, name, created_by) VALUES ($1, $2, $3)', [residentId, name, userId]);
  return getResident(residentId, { isAdmin: true });
}

export async function deleteCondition(residentId, conditionId) {
  const { rowCount } = await query('DELETE FROM resident_conditions WHERE id = $1 AND resident_id = $2', [conditionId, residentId]);
  if (rowCount === 0) throw AppError.notFound('Patología no encontrada');
  return getResident(residentId, { isAdmin: true });
}

export async function addMedication(residentId, input, userId) {
  await assertResident(residentId);
  await query(
    `INSERT INTO resident_medications (resident_id, name, dose, schedule, instructions, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6)`,
    [residentId, input.name, input.dose, input.schedule, input.instructions, userId],
  );
  return getResident(residentId, { isAdmin: true });
}

export async function updateMedication(residentId, medicationId, input, userId) {
  const { rowCount } = await query(
    `UPDATE resident_medications SET name = $1, dose = $2, schedule = $3, instructions = $4, updated_by = $5
      WHERE id = $6 AND resident_id = $7`,
    [input.name, input.dose, input.schedule, input.instructions, userId, medicationId, residentId],
  );
  if (rowCount === 0) throw AppError.notFound('Medicamento no encontrado');
  return getResident(residentId, { isAdmin: true });
}

export async function deleteMedication(residentId, medicationId) {
  const { rowCount } = await query('DELETE FROM resident_medications WHERE id = $1 AND resident_id = $2', [medicationId, residentId]);
  if (rowCount === 0) throw AppError.notFound('Medicamento no encontrado');
  return getResident(residentId, { isAdmin: true });
}

// ---------------------------------------------------------------------
// Cumpleaños
// ---------------------------------------------------------------------

/**
 * Residentes activos que están de cumpleaños hoy (fecha de Chile).
 * Los nacidos un 29 de febrero lo celebran el 28 en años no bisiestos.
 */
export async function birthdaysToday(siteId) {
  const { rows } = await query(
    `WITH today AS (SELECT (now() AT TIME ZONE 'America/Santiago')::date AS d)
     SELECT r.id, r.first_name, r.last_name, s.name AS site_name, r.room, r.bed,
            date_part('year', age(today.d, r.birth_date))::int AS age
       FROM residents r JOIN sites s ON s.id = r.site_id, today
      WHERE r.is_active
        AND ($1::smallint IS NULL OR r.site_id = $1)
        AND (
          to_char(r.birth_date, 'MM-DD') = to_char(today.d, 'MM-DD')
          OR (to_char(r.birth_date, 'MM-DD') = '02-29' AND to_char(today.d, 'MM-DD') = '02-28'
              AND NOT (date_part('year', today.d)::int % 4 = 0
                       AND (date_part('year', today.d)::int % 100 <> 0 OR date_part('year', today.d)::int % 400 = 0)))
        )
      ORDER BY r.first_name, r.last_name`,
    [siteId ?? null],
  );
  return rows;
}
