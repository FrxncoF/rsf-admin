import { query } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { cleanRut } from '../../utils/rut.js';
import { escapeLike } from '../../utils/sql.js';

// Residentes vinculados al apoderado, con el parentesco de cada vínculo
const COLUMNS = `
  g.id, g.full_name, g.rut, g.phone, g.email, g.address, g.is_active, g.created_at, g.updated_at,
  COALESCE((
    SELECT json_agg(json_build_object(
      'id', r.id, 'first_name', r.first_name, 'last_name', r.last_name, 'is_active', r.is_active,
      'site_name', s.name, 'room', r.room, 'bed', r.bed,
      'relationship', rg.relationship, 'position', rg.position
    ) ORDER BY r.last_name, r.first_name)
    FROM resident_guardians rg
    JOIN residents r ON r.id = rg.resident_id
    JOIN sites s ON s.id = r.site_id
    WHERE rg.guardian_id = g.id
  ), '[]'::json) AS residents`;

export async function listGuardians({ search, status, page, pageSize }) {
  const where = [];
  const params = [];
  if (status === 'active') where.push('g.is_active = TRUE');
  if (status === 'inactive') where.push('g.is_active = FALSE');

  if (search) {
    params.push(`%${escapeLike(search.toLowerCase())}%`);
    const conditions = [`lower(g.full_name) LIKE $${params.length}`];
    const digits = search.replace(/\D/g, '');
    if (digits.length >= 3) {
      params.push(`%${digits}%`);
      conditions.push(`g.phone LIKE $${params.length}`);
      params.push(`%${cleanRut(search)}%`);
      conditions.push(`replace(g.rut, '-', '') LIKE $${params.length}`);
    }
    where.push(`(${conditions.join(' OR ')})`);
  }

  params.push(pageSize, (page - 1) * pageSize);
  const { rows } = await query(
    `SELECT ${COLUMNS}, COUNT(*) OVER() AS total_count
       FROM guardians g
       ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY g.full_name
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    data: rows.map(({ total_count: _t, ...row }) => row),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function getGuardian(id) {
  const { rows } = await query(`SELECT ${COLUMNS} FROM guardians g WHERE g.id = $1`, [id]);
  if (!rows[0]) throw AppError.notFound('Apoderado no encontrado');
  return rows[0];
}

/** `db` permite usarlo dentro de una transacción (alta desde el formulario de residente). */
export async function insertGuardian(data, userId, db = { query }) {
  const { rows } = await db.query(
    `INSERT INTO guardians (full_name, rut, phone, email, address, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5, $6, $6)
     RETURNING id`,
    [data.full_name, data.rut, data.phone, data.email, data.address, userId],
  );
  return rows[0].id;
}

export async function createGuardian(data, userId) {
  return getGuardian(await insertGuardian(data, userId));
}

export async function updateGuardian(id, data, userId) {
  const { rowCount } = await query(
    `UPDATE guardians
        SET full_name = $1, rut = $2, phone = $3, email = $4, address = $5, updated_by = $6
      WHERE id = $7`,
    [data.full_name, data.rut, data.phone, data.email, data.address, userId, id],
  );
  if (rowCount === 0) throw AppError.notFound('Apoderado no encontrado');
  return getGuardian(id);
}

/** Desactivar no borra al apoderado: solo deja de aparecer en búsquedas y no se puede asignar. */
export async function setGuardianStatus(id, isActive, userId) {
  if (!isActive) {
    const { rows } = await query(
      `SELECT count(*)::int AS n FROM resident_guardians rg JOIN residents r ON r.id = rg.resident_id
        WHERE rg.guardian_id = $1 AND r.is_active`,
      [id],
    );
    if (rows[0].n > 0) {
      throw AppError.conflict('No se puede desactivar: es apoderado de residentes activos. Primero reemplázalo en cada residente.');
    }
  }
  const { rowCount } = await query('UPDATE guardians SET is_active = $1, updated_by = $2 WHERE id = $3', [isActive, userId, id]);
  if (rowCount === 0) throw AppError.notFound('Apoderado no encontrado');
  return getGuardian(id);
}
