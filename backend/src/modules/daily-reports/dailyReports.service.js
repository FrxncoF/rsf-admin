import { query } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { hasAdminAccess, ROLES } from '../../middlewares/auth.js';
import { getSetting } from '../settings/settings.service.js';
import { shiftBounds } from '../daily-logs/dailyLogs.service.js';
import { NIGHT_AREA } from './dailyReports.validators.js';

const COLUMNS = `
  r.id, r.site_id, s.name AS site_name, to_char(r.report_date, 'YYYY-MM-DD') AS report_date, r.area, r.body,
  r.created_by, u.full_name AS author, r.created_at, r.updated_at, uu.full_name AS updated_by_name`;

const FROM = `
  FROM daily_reports r
  JOIN sites s ON s.id = r.site_id
  JOIN users u ON u.id = r.created_by
  LEFT JOIN users uu ON uu.id = r.updated_by`;

const DUPLICATE = 'Ya existe un reporte de esa área para ese día en esa sede. Ábrelo para editarlo.';

/** Las cuidadoras solo tienen el reporte del turno noche; ENCARGADA y ADMIN/SOPORTE, todas las áreas. */
const nightOnly = (user) => user.role === ROLES.CUIDADORA;

function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function plusHours(stamp, hours) {
  const d = new Date(`${stamp.replace(' ', 'T')}:00Z`);
  d.setUTCHours(d.getUTCHours() + hours);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}

// Margen para completar después del turno, igual que la ficha por turno (configurable en Soporte)
const DEFAULT_GRACE_HOURS = 1;

/**
 * Fechas "abiertas" en hora de Chile:
 *  · today: día calendario (Kine, TO, Enfermería, Encargada de turno).
 *  · night_date: la noche abierta, con el mismo horario que la ficha nocturna del residente:
 *    desde el inicio del turno noche hasta el inicio del turno día + margen (Soporte → Turnos).
 *    Fuera de ese horario es null (no se puede escribir ni corregir).
 *  · last_night: la noche abierta o, si no hay, la última que terminó (para mostrarla por defecto).
 */
async function openDates() {
  const [{ rows }, shifts] = await Promise.all([
    query(
      `SELECT to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') AS date,
              to_char(now() AT TIME ZONE 'America/Santiago', 'HH24:MI') AS time`,
    ),
    getSetting('shifts'),
  ]);
  const now = rows[0];
  const nowStamp = `${now.date} ${now.time}`;
  const grace = shifts.edit_grace_hours ?? DEFAULT_GRACE_HOURS;

  // La noche que empezó ayer (puede seguir abierta en la mañana) y la que empieza hoy
  const nights = [addDays(now.date, -1), now.date].map((date) => {
    const { start, end } = shiftBounds({ shift: 'NOCHE', shift_date: date }, shifts);
    return { date, start, closes_at: plusHours(end, grace) };
  });
  const open = nights.find((n) => nowStamp >= n.start && nowStamp < n.closes_at) ?? null;
  return {
    today: now.date,
    night_date: open?.date ?? null,
    night_opens_at: open ? null : nights.find((n) => n.start > nowStamp)?.start ?? null,
    night_closes_at: open?.closes_at ?? null,
    last_night: open?.date ?? addDays(now.date, -1),
  };
}

const openDateFor = (area, dates) => (area === NIGHT_AREA ? dates.night_date : dates.today);

/** Quien lo escribió lo corrige mientras su día (o su turno noche + margen) siga abierto; ADMIN/SOPORTE siempre. */
const canEdit = (report, user, dates) =>
  hasAdminAccess(user) || (report.created_by === user.id && report.report_date === openDateFor(report.area, dates));

const decorate = (user, dates) => (report) => ({ ...report, editable: canEdit(report, user, dates) });

function assertAreaAllowed(area, user) {
  if (nightOnly(user) && area !== NIGHT_AREA) throw AppError.forbidden('Solo puedes escribir el reporte del turno noche.');
}

async function findReport(id, user) {
  const { rows } = await query(`SELECT ${COLUMNS} ${FROM} WHERE r.id = $1`, [id]);
  // A una cuidadora, los reportes de otras áreas no le existen
  if (!rows[0] || (nightOnly(user) && rows[0].area !== NIGHT_AREA)) throw AppError.notFound('Reporte no encontrado');
  return rows[0];
}

export async function listReports({ site_id: siteId, date, area }, user) {
  const dates = await openDates();
  // Sin fecha: a la cuidadora se le muestra la noche abierta (o la última); al resto, hoy
  const day = date ?? (nightOnly(user) ? dates.last_night : dates.today);
  const params = [day];
  const where = ['r.report_date = $1'];
  if (siteId) where.push(`r.site_id = $${params.push(siteId)}`);
  if (nightOnly(user)) where.push(`r.area = $${params.push(NIGHT_AREA)}`);
  else if (area) where.push(`r.area = $${params.push(area)}`);
  const { rows } = await query(
    `SELECT ${COLUMNS} ${FROM} WHERE ${where.join(' AND ')} ORDER BY s.name, r.created_at`,
    params,
  );
  return { date: day, ...dates, night_only: nightOnly(user), data: rows.map(decorate(user, dates)) };
}

/** Se crea con la fecha abierta del área: hoy, o la noche en curso. Uno por sede, fecha y área. */
export async function createReport({ site_id: siteId, area, body }, user) {
  assertAreaAllowed(area, user);
  const dates = await openDates();
  if (!openDateFor(area, dates)) {
    throw AppError.badRequest(
      `El reporte del turno noche se puede escribir desde las ${dates.night_opens_at?.slice(11) ?? 'el inicio del turno noche'}.`,
    );
  }
  const { rows } = await query(
    `INSERT INTO daily_reports (site_id, report_date, area, body, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (site_id, report_date, area) DO NOTHING
     RETURNING id`,
    [siteId, openDateFor(area, dates), area, body, user.id],
  );
  if (!rows[0]) throw AppError.conflict(DUPLICATE);
  return decorate(user, dates)(await findReport(rows[0].id, user));
}

export async function updateReport(id, changes, user) {
  const [report, dates] = await Promise.all([findReport(id, user), openDates()]);
  if (changes.area) assertAreaAllowed(changes.area, user);
  if (!canEdit(report, user, dates)) {
    throw AppError.forbidden(
      report.created_by !== user.id
        ? 'Solo quien escribió el reporte (o una administradora) puede modificarlo.'
        : 'Este reporte ya está cerrado. Solo una administradora puede modificarlo.',
    );
  }
  // Cambiar entre "Turno noche" y un área de día movería la fecha: no se permite
  if (changes.area && !hasAdminAccess(user) && (changes.area === NIGHT_AREA) !== (report.area === NIGHT_AREA)) {
    throw AppError.badRequest('El turno noche no se puede cambiar a otra área. Escribe un reporte nuevo.');
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
  return decorate(user, dates)(await findReport(id, user));
}
