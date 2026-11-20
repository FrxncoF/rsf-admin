import { query } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { hasAdminAccess } from '../../middlewares/auth.js';

const COLUMNS = `
  r.id, r.site_id, s.name AS site_name, to_char(r.report_date, 'YYYY-MM-DD') AS report_date, r.area, r.body,
  r.created_by, u.full_name AS author, r.created_at, r.updated_at, uu.full_name AS updated_by_name`;

const FROM = `
  FROM daily_reports r
  JOIN sites s ON s.id = r.site_id
  JOIN users u ON u.id = r.created_by
  LEFT JOIN users uu ON uu.id = r.updated_by`;

const DUPLICATE = 'Ya existe un reporte de esa área para ese día en esa sede. Ábrelo para editarlo.';

async function chileToday() {
  const { rows } = await query(`SELECT to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') AS today`);
  return rows[0].today;
}

/** Quien lo escribió lo corrige el mismo día (hora de Chile); ADMIN/SOPORTE siempre. */
const canEdit = (report, user, today) =>
  hasAdminAccess(user) || (report.created_by === user.id && report.report_date === today);

const decorate = (user, today) => (report) => ({ ...report, editable: canEdit(report, user, today) });

async function findReport(id) {
  const { rows } = await query(`SELECT ${COLUMNS} ${FROM} WHERE r.id = $1`, [id]);
  if (!rows[0]) throw AppError.notFound('Reporte no encontrado');
  return rows[0];
}

export async function listReports({ site_id: siteId, date, area }, user) {
  const today = await chileToday();
  const day = date ?? today;
  const params = [day];
  const where = ['r.report_date = $1'];
  if (siteId) where.push(`r.site_id = $${params.push(siteId)}`);
  if (area) where.push(`r.area = $${params.push(area)}`);
  const { rows } = await query(
    `SELECT ${COLUMNS} ${FROM} WHERE ${where.join(' AND ')} ORDER BY s.name, r.created_at`,
    params,
  );
  return { date: day, today, data: rows.map(decorate(user, today)) };
}

/** Siempre se crea con la fecha de hoy (Chile): uno por sede, día y área. */
export async function createReport({ site_id: siteId, area, body }, user) {
  const today = await chileToday();
  const { rows } = await query(
    `INSERT INTO daily_reports (site_id, report_date, area, body, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (site_id, report_date, area) DO NOTHING
     RETURNING id`,
    [siteId, today, area, body, user.id],
  );
  if (!rows[0]) throw AppError.conflict(DUPLICATE);
  return decorate(user, today)(await findReport(rows[0].id));
}

export async function updateReport(id, changes, user) {
  const [report, today] = await Promise.all([findReport(id), chileToday()]);
  if (!canEdit(report, user, today)) {
    throw AppError.forbidden(
      report.created_by !== user.id
        ? 'Solo quien escribió el reporte (o una administradora) puede modificarlo.'
        : 'Este reporte ya está cerrado. Solo una administradora puede modificarlo.',
    );
  }
  try {
    await query(
      `UPDATE daily_reports
          SET area = COALESCE($2, area), body = COALESCE($3, body), updated_by = $4, updated_at = now()
        WHERE id = $1`,
      [id, changes.area ?? null, changes.body ?? null, user.id],
    );
  } catch (err) {
    if (err.code === '23505') throw AppError.conflict(DUPLICATE);
    throw err;
  }
  return decorate(user, today)(await findReport(id));
}
