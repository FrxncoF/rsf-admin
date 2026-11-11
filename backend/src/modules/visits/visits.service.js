import { query } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { hasAdminAccess } from '../../middlewares/auth.js';

const COLUMNS = `
  v.id, v.resident_id, r.first_name, r.last_name, r.room, r.bed, v.site_id, s.name AS site_name,
  v.guardian_id, v.visitor_name, v.relationship, v.visit_at, v.created_at, u.full_name AS author`;

const FROM = `
  FROM visits v
  JOIN residents r ON r.id = v.resident_id
  JOIN sites s ON s.id = v.site_id
  JOIN users u ON u.id = v.created_by`;

export async function listVisits({ site_id: siteId, resident_id: residentId, page, pageSize }, { isAdmin }) {
  const where = [];
  const params = [];
  // La cuidadora no ve historial de residentes dados de baja
  if (!isAdmin) where.push('r.is_active = TRUE');
  if (siteId) {
    params.push(siteId);
    where.push(`v.site_id = $${params.length}`);
  }
  if (residentId) {
    params.push(residentId);
    where.push(`v.resident_id = $${params.length}`);
  }

  params.push(pageSize, (page - 1) * pageSize);
  const { rows } = await query(
    `SELECT ${COLUMNS}, COUNT(*) OVER() AS total_count
     ${FROM}
     ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
     ORDER BY v.visit_at DESC
     LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    data: rows.map(({ total_count: _t, ...row }) => row),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function createVisit(input, user) {
  const { rows: residents } = await query('SELECT is_active, site_id FROM residents WHERE id = $1', [input.resident_id]);
  if (!residents[0] || (!hasAdminAccess(user) && !residents[0].is_active)) throw AppError.notFound('Residente no encontrado');
  if (residents[0].site_id !== input.site_id) throw AppError.badRequest('El residente no pertenece a la sede seleccionada');

  let visitorName = input.visitor_name;
  let relationship = input.relationship || null;

  if (input.guardian_id) {
    // Solo se aceptan apoderados de ese residente; se copia nombre y parentesco
    const { rows } = await query(
      `SELECT g.full_name, rg.relationship
         FROM resident_guardians rg JOIN guardians g ON g.id = rg.guardian_id
        WHERE rg.resident_id = $1 AND rg.guardian_id = $2`,
      [input.resident_id, input.guardian_id],
    );
    if (!rows[0]) throw AppError.badRequest('Ese apoderado no está asociado al residente');
    visitorName = rows[0].full_name;
    relationship = rows[0].relationship;
  }

  const { rows } = await query(
    `INSERT INTO visits (site_id, resident_id, guardian_id, visitor_name, relationship, visit_at, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [input.site_id, input.resident_id, input.guardian_id ?? null, visitorName, relationship, input.visit_at, user.id],
  );
  const { rows: created } = await query(`SELECT ${COLUMNS} ${FROM} WHERE v.id = $1`, [rows[0].id]);
  return created[0];
}

export async function deleteVisit(id) {
  const { rowCount } = await query('DELETE FROM visits WHERE id = $1', [id]);
  if (rowCount === 0) throw AppError.notFound('Visita no encontrada');
}
