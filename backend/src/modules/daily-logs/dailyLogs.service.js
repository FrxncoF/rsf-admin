import { query } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { hasAdminAccess } from '../../middlewares/auth.js';

const NOTES_JSON = `
  COALESCE((
    SELECT json_agg(json_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at, 'author', nu.full_name)
                    ORDER BY n.created_at)
    FROM daily_log_notes n JOIN users nu ON nu.id = n.created_by
    WHERE n.daily_log_id = l.id
  ), '[]'::json) AS notes`;

const COLUMNS = `l.id, l.resident_id, l.data, l.created_at, l.created_by, u.full_name AS author, ${NOTES_JSON}`;

/** La cuidadora solo trabaja con residentes activos. */
async function assertResidentVisible(residentId, isAdmin) {
  const { rows } = await query('SELECT is_active FROM residents WHERE id = $1', [residentId]);
  if (!rows[0] || (!isAdmin && !rows[0].is_active)) throw AppError.notFound('Residente no encontrado');
}

export async function listDailyLogs({ resident_id: residentId, page, pageSize }, { isAdmin }) {
  await assertResidentVisible(residentId, isAdmin);
  const { rows } = await query(
    `SELECT ${COLUMNS}, COUNT(*) OVER() AS total_count
       FROM daily_logs l JOIN users u ON u.id = l.created_by
      WHERE l.resident_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2 OFFSET $3`,
    [residentId, pageSize, (page - 1) * pageSize],
  );
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    data: rows.map(({ total_count: _t, ...row }) => row),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

async function getDailyLog(id) {
  const { rows } = await query(
    `SELECT ${COLUMNS} FROM daily_logs l JOIN users u ON u.id = l.created_by WHERE l.id = $1`,
    [id],
  );
  if (!rows[0]) throw AppError.notFound('Ficha no encontrada');
  return rows[0];
}

export async function createDailyLog({ resident_id: residentId, data }, user) {
  await assertResidentVisible(residentId, hasAdminAccess(user));
  const { rows } = await query(
    'INSERT INTO daily_logs (resident_id, data, created_by) VALUES ($1, $2, $3) RETURNING id',
    [residentId, data, user.id],
  );
  return getDailyLog(rows[0].id);
}

/** Las fichas no se editan: las correcciones se agregan como notas. */
export async function addNote(dailyLogId, { body }, user) {
  const log = await getDailyLog(dailyLogId);
  await assertResidentVisible(log.resident_id, hasAdminAccess(user));
  await query('INSERT INTO daily_log_notes (daily_log_id, body, created_by) VALUES ($1, $2, $3)', [dailyLogId, body, user.id]);
  return getDailyLog(dailyLogId);
}
