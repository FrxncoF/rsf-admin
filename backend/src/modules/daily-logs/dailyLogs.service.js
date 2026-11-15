import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { hasAdminAccess } from '../../middlewares/auth.js';
import { getSetting } from '../settings/settings.service.js';
import { fullDataSchema, NESTED_KEYS } from './dailyLogs.validators.js';

// Margen para completar la ficha después de terminado el turno (configurable en Soporte)
const DEFAULT_GRACE_HOURS = 1;

const NOTES_JSON = `
  COALESCE((
    SELECT json_agg(json_build_object('id', n.id, 'body', n.body, 'created_at', n.created_at, 'author', nu.full_name)
                    ORDER BY n.created_at)
    FROM daily_log_notes n JOIN users nu ON nu.id = n.created_by
    WHERE n.daily_log_id = l.id
  ), '[]'::json) AS notes`;

// Quiénes anotaron algo en la ficha (creador + autores de cambios), en orden de aparición
const CONTRIBUTORS_JSON = `
  COALESCE((
    SELECT json_agg(x.full_name ORDER BY x.first_at)
    FROM (
      SELECT cu.full_name, min(c.changed_at) AS first_at
        FROM daily_log_changes c JOIN users cu ON cu.id = c.changed_by
       WHERE c.daily_log_id = l.id
       GROUP BY cu.full_name
    ) x
  ), json_build_array(u.full_name)) AS contributors`;

const COLUMNS = `
  l.id, l.resident_id, l.data, l.created_at, l.created_by, u.full_name AS author,
  to_char(l.shift_date, 'YYYY-MM-DD') AS shift_date, l.shift, l.legacy, l.updated_at, uu.full_name AS updated_by_name,
  (SELECT count(*)::int FROM daily_log_changes c WHERE c.daily_log_id = l.id) AS change_count,
  ${CONTRIBUTORS_JSON}, ${NOTES_JSON}`;

const FROM = `
  FROM daily_logs l
  JOIN users u ON u.id = l.created_by
  LEFT JOIN users uu ON uu.id = l.updated_by`;

// ---------------------------------------------------------------------
// Turnos (hora de Chile)
// ---------------------------------------------------------------------

async function chileNow() {
  const { rows } = await query(
    `SELECT to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') AS date,
            to_char(now() AT TIME ZONE 'America/Santiago', 'HH24:MI') AS time`,
  );
  return rows[0];
}

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Turno en curso: el de día va de day_start a night_start; la noche cruza la medianoche. */
export function currentShift(now, shifts) {
  if (now.time >= shifts.day_start && now.time < shifts.night_start) return { shift: 'DIA', shift_date: now.date };
  return { shift: 'NOCHE', shift_date: now.time >= shifts.night_start ? now.date : addDays(now.date, -1) };
}

/** Inicio y término del turno como "YYYY-MM-DD HH:MM" (comparables como texto). */
export function shiftBounds({ shift, shift_date: date }, shifts) {
  return shift === 'DIA'
    ? { start: `${date} ${shifts.day_start}`, end: `${date} ${shifts.night_start}` }
    : { start: `${date} ${shifts.night_start}`, end: `${addDays(date, 1)} ${shifts.day_start}` };
}

function plusHours(stamp, hours) {
  const d = new Date(`${stamp.replace(' ', 'T')}:00Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

/**
 * ¿Se puede editar la ficha ahora? Durante el turno sí; terminado el turno, solo durante el margen
 * configurado (para que quien sale termine de anotar). Después queda cerrada para todos.
 */
function editability(log, shifts) {
  return (now) => {
    if (log.legacy) return { editable: false, open: false, closes_at: null };
    const { end } = shiftBounds(log, shifts);
    const nowStamp = `${now.date} ${now.time}`;
    const closesAt = plusHours(end, shifts.edit_grace_hours ?? DEFAULT_GRACE_HOURS);
    return { open: nowStamp < end, editable: nowStamp < closesAt, closes_at: closesAt };
  };
}

async function context(user) {
  const [shifts, now] = await Promise.all([getSetting('shifts'), chileNow()]);
  const decorate = (log) => ({ ...log, ...editability(log, shifts)(now), ...shiftBounds(log, shifts) });
  return { shifts, now, decorate };
}

// ---------------------------------------------------------------------
// Lectura
// ---------------------------------------------------------------------

/** La cuidadora solo trabaja con residentes activos. */
async function assertResidentVisible(residentId, isAdmin) {
  const { rows } = await query('SELECT is_active FROM residents WHERE id = $1', [residentId]);
  if (!rows[0] || (!isAdmin && !rows[0].is_active)) throw AppError.notFound('Residente no encontrado');
  return rows[0];
}

export async function listDailyLogs({ resident_id: residentId, page, pageSize }, user) {
  await assertResidentVisible(residentId, hasAdminAccess(user));
  const { decorate } = await context(user);
  const { rows } = await query(
    `SELECT ${COLUMNS}, COUNT(*) OVER() AS total_count
       ${FROM}
      WHERE l.resident_id = $1
      ORDER BY l.shift_date DESC, (l.shift = 'NOCHE') DESC, l.created_at DESC
      LIMIT $2 OFFSET $3`,
    [residentId, pageSize, (page - 1) * pageSize],
  );
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    data: rows.map(({ total_count: _t, ...row }) => decorate(row)),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

async function fetchLog(id, db = { query }) {
  const { rows } = await db.query(`SELECT ${COLUMNS} ${FROM} WHERE l.id = $1`, [id]);
  if (!rows[0]) throw AppError.notFound('Ficha no encontrada');
  return rows[0];
}

export async function getDailyLog(id, user) {
  const log = await fetchLog(id);
  await assertResidentVisible(log.resident_id, hasAdminAccess(user));
  const { decorate } = await context(user);
  return decorate(log);
}

/** Turno en curso y su ficha (null si nadie ha anotado nada todavía). */
export async function getCurrent({ resident_id: residentId }, user) {
  await assertResidentVisible(residentId, hasAdminAccess(user));
  const { shifts, now, decorate } = await context(user);
  const shift = currentShift(now, shifts);
  const { rows } = await query(`SELECT l.id FROM daily_logs l WHERE l.resident_id = $1 AND l.shift_date = $2 AND l.shift = $3 AND NOT l.legacy`, [
    residentId,
    shift.shift_date,
    shift.shift,
  ]);
  return {
    ...shift,
    ...shiftBounds(shift, shifts),
    log: rows[0] ? decorate(await fetchLog(rows[0].id)) : null,
  };
}

export async function listChanges(id, user) {
  const log = await fetchLog(id);
  await assertResidentVisible(log.resident_id, hasAdminAccess(user));
  const { rows } = await query(
    `SELECT c.id, c.changes, c.changed_at, u.full_name AS author
       FROM daily_log_changes c JOIN users u ON u.id = c.changed_by
      WHERE c.daily_log_id = $1 ORDER BY c.changed_at`,
    [id],
  );
  return rows;
}

// ---------------------------------------------------------------------
// Guardado parcial
// ---------------------------------------------------------------------

/** Junta lo guardado con los cambios: en los grupos solo se reemplazan los datos enviados. */
function merge(current, patch) {
  const out = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    out[key] = NESTED_KEYS.includes(key) ? { ...(current[key] ?? {}), ...value } : value;
  }
  return out;
}

/** { "vitals.pa_s": [antes, después], ... } solo con lo que cambió. */
function diff(before, after) {
  const changes = {};
  for (const key of Object.keys(after)) {
    if (NESTED_KEYS.includes(key)) {
      for (const sub of Object.keys(after[key] ?? {})) {
        const a = before[key]?.[sub] ?? null;
        const b = after[key][sub] ?? null;
        if (JSON.stringify(a) !== JSON.stringify(b)) changes[`${key}.${sub}`] = [a, b];
      }
    } else if (JSON.stringify(before[key] ?? null) !== JSON.stringify(after[key] ?? null)) {
      changes[key] = [before[key] ?? null, after[key] ?? null];
    }
  }
  return changes;
}

async function applyPatch(client, logId, patch, user) {
  const { rows } = await client.query('SELECT data FROM daily_logs WHERE id = $1 FOR UPDATE', [logId]);
  const before = fullDataSchema.parse(rows[0].data ?? {});
  const result = fullDataSchema.safeParse(merge(before, patch));
  if (!result.success) throw AppError.badRequest('Hay datos fuera de rango', { patch: result.error.issues[0]?.message });
  const after = result.data;
  const changes = diff(before, after);
  if (Object.keys(changes).length === 0) return;
  await client.query('UPDATE daily_logs SET data = $1, updated_at = now(), updated_by = $2 WHERE id = $3', [after, user.id, logId]);
  await client.query('INSERT INTO daily_log_changes (daily_log_id, changes, changed_by) VALUES ($1, $2, $3)', [logId, changes, user.id]);
}

/** Guarda en la ficha del turno en curso; la crea con el primer dato. */
export async function saveCurrent({ resident_id: residentId, patch }, user) {
  const resident = await assertResidentVisible(residentId, hasAdminAccess(user));
  if (!resident.is_active) throw AppError.badRequest('El residente está desactivado');
  const { shifts, now, decorate } = await context(user);
  const shift = currentShift(now, shifts);
  const id = await withTransaction(async (client) => {
    await client.query(
      `INSERT INTO daily_logs (resident_id, data, created_by, updated_by, shift_date, shift)
       VALUES ($1, '{}', $2, $2, $3, $4)
       ON CONFLICT (resident_id, shift_date, shift) WHERE NOT legacy DO NOTHING`,
      [residentId, user.id, shift.shift_date, shift.shift],
    );
    const { rows } = await client.query(
      'SELECT id FROM daily_logs WHERE resident_id = $1 AND shift_date = $2 AND shift = $3 AND NOT legacy',
      [residentId, shift.shift_date, shift.shift],
    );
    await applyPatch(client, rows[0].id, patch, user);
    return rows[0].id;
  });
  return decorate(await fetchLog(id));
}

/** Edita una ficha específica: la del turno en curso, o (ADMIN) una cerrada hace menos de 24 h. */
export async function saveLog(id, { patch }, user) {
  const log = await fetchLog(id);
  await assertResidentVisible(log.resident_id, hasAdminAccess(user));
  const { shifts, now, decorate } = await context(user);
  const { editable } = editability(log, shifts)(now);
  if (!editable) {
    throw AppError.conflict(
      log.legacy ? 'Las fichas anteriores no se editan: agrega una nota.' : 'Esta ficha ya está cerrada (terminó su turno). Para aclarar algo, agrégale una nota.',
    );
  }
  await withTransaction((client) => applyPatch(client, id, patch, user));
  return decorate(await fetchLog(id));
}

/** Las notas se pueden agregar siempre (también a fichas cerradas). */
export async function addNote(dailyLogId, { body }, user) {
  const log = await fetchLog(dailyLogId);
  await assertResidentVisible(log.resident_id, hasAdminAccess(user));
  await query('INSERT INTO daily_log_notes (daily_log_id, body, created_by) VALUES ($1, $2, $3)', [dailyLogId, body, user.id]);
  return getDailyLog(dailyLogId, user);
}
