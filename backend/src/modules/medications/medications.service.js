import { query } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { MEDICATION_TIMES } from '../residents/residents.service.js';

const TODAY = `(now() AT TIME ZONE 'America/Santiago')::date`;

/** Hoy y ayer (Chile): las dosis se registran o corrigen solo en ese rango (turno de noche). */
async function assertEditableDate(date) {
  const { rows } = await query(`SELECT $1::date BETWEEN ${TODAY} - 1 AND ${TODAY} AS ok, ${TODAY}::text AS today`, [date]);
  if (!rows[0].ok) throw AppError.badRequest('Solo se pueden registrar dosis de hoy o de ayer');
}

/**
 * Residentes activos con sus medicamentos vigentes y las dosis registradas en `date`.
 * Lo usan la pantalla "Medicación" (dar dosis) y el "Pastillero".
 */
export async function getSchedule({ site_id: siteId, date }) {
  const params = [];
  let dateExpr = TODAY;
  if (date) {
    params.push(date);
    dateExpr = `$${params.length}::date`;
  }
  let siteFilter = '';
  if (siteId) {
    params.push(siteId);
    siteFilter = `AND r.site_id = $${params.length}`;
  }

  const { rows } = await query(
    `SELECT r.id, r.first_name, r.last_name, r.room, r.bed, r.photo_path IS NOT NULL AS has_photo, r.updated_at,
            r.site_id, s.name AS site_name,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'id', m.id, 'name', m.name, 'dose', m.dose, 'instructions', m.instructions,
                       'schedule', m.schedule, 'is_sos', m.is_sos, 'times', ${MEDICATION_TIMES})
                     ORDER BY m.is_sos, m.times[1] NULLS LAST, lower(m.name))
                FROM resident_medications m
               WHERE m.resident_id = r.id AND m.ended_at IS NULL
            ), '[]'::json) AS medications,
            COALESCE((
              SELECT json_agg(json_build_object(
                       'id', d.id, 'medication_id', d.medication_id, 'time', to_char(d.dose_time, 'HH24:MI'),
                       'status', d.status, 'note', d.note, 'recorded_at', d.recorded_at, 'recorded_by', u.full_name)
                     ORDER BY d.dose_time)
                FROM medication_doses d JOIN users u ON u.id = d.recorded_by
               WHERE d.resident_id = r.id AND d.dose_date = ${dateExpr}
            ), '[]'::json) AS doses
       FROM residents r
       JOIN sites s ON s.id = r.site_id
      WHERE r.is_active = TRUE ${siteFilter}
      ORDER BY s.name, lower(r.last_name), lower(r.first_name)`,
    params,
  );
  const { rows: meta } = await query(`SELECT ${dateExpr}::text AS date, ${TODAY}::text AS today`, date ? [date] : []);
  return { date: meta[0].date, today: meta[0].today, residents: rows };
}

/** Registra (o corrige) el estado de una dosis: Dado / Rechazó / No se dio. */
export async function recordDose(input, user) {
  await assertEditableDate(input.date);

  const { rows } = await query(
    `SELECT m.resident_id, m.is_sos, ARRAY(SELECT to_char(t, 'HH24:MI') FROM unnest(m.times) t) AS times
       FROM resident_medications m JOIN residents r ON r.id = m.resident_id
      WHERE m.id = $1 AND m.ended_at IS NULL AND r.is_active = TRUE`,
    [input.medication_id],
  );
  const med = rows[0];
  if (!med) throw AppError.notFound('Medicamento no encontrado');
  // Un medicamento programado solo se registra en sus horas; el SOS, a la hora en que se dio
  if (!med.is_sos && !med.times.includes(input.time)) {
    throw AppError.badRequest('Esa hora no corresponde al horario del medicamento');
  }

  const { rows: saved } = await query(
    `INSERT INTO medication_doses (medication_id, resident_id, dose_date, dose_time, status, note, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (medication_id, dose_date, dose_time)
     DO UPDATE SET status = EXCLUDED.status, note = EXCLUDED.note,
                   recorded_by = EXCLUDED.recorded_by, recorded_at = now()
     RETURNING id, medication_id, to_char(dose_time, 'HH24:MI') AS time, status, note, recorded_at`,
    [input.medication_id, med.resident_id, input.date, input.time, input.status, input.note, user.id],
  );
  return { ...saved[0], recorded_by: user.full_name };
}

/** Deshacer un registro (se equivocó de botón). Mismo rango de fechas que al registrar. */
export async function deleteDose(id) {
  const { rows } = await query('SELECT dose_date::text AS date FROM medication_doses WHERE id = $1', [id]);
  if (!rows[0]) throw AppError.notFound('Registro no encontrado');
  await assertEditableDate(rows[0].date);
  await query('DELETE FROM medication_doses WHERE id = $1', [id]);
}
