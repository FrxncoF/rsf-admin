import { randomInt } from 'node:crypto';
import { query, withTransaction } from '../../db/pool.js';
import { AppError } from '../../utils/AppError.js';
import { getSetting } from '../settings/settings.service.js';

// Reservas que ocupan cupo
const ACTIVE = `('BOOKED', 'CONFIRMED')`;
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/O, 1/I/L para dictarlo por teléfono

// --- Utilidades de fecha (todo en hora de Chile) ---

async function chileNow() {
  const { rows } = await query(
    `SELECT to_char(now() AT TIME ZONE 'America/Santiago', 'YYYY-MM-DD') AS date,
            to_char(now() AT TIME ZONE 'America/Santiago', 'HH24:MI') AS time`,
  );
  return rows[0];
}

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Días que se pueden reservar.
 *  · Público: desde mañana hasta `days_ahead`; el día siguiente cierra a la hora límite de hoy.
 *  · Equipo (staff): desde hoy y sin hora límite (reservas por teléfono).
 */
function bookableDays(settings, now, { staff = false } = {}) {
  const blocked = new Map(settings.blocked_dates.map((d) => [d.date, d.reason]));
  const days = [];
  for (let i = staff ? 0 : 1; i <= settings.days_ahead; i++) {
    const date = addDays(now.date, i);
    let closed = null;
    if (blocked.has(date)) closed = blocked.get(date) || 'Sin visitas este día';
    else if (!staff && i === 1 && now.time >= settings.cutoff_time) closed = `Las reservas para mañana cierran a las ${settings.cutoff_time}`;
    days.push({ date, closed });
  }
  return days;
}

const activeBlocks = (settings) => settings.blocks.filter((b) => b.active);

/** Valida día y bloque contra la configuración; devuelve el bloque. */
function assertSlot(settings, now, date, start, { staff = false } = {}) {
  const day = bookableDays(settings, now, { staff }).find((d) => d.date === date);
  if (!day) {
    throw AppError.badRequest(
      staff
        ? `Solo se puede agendar desde hoy hasta ${settings.days_ahead} días más`
        : `Las visitas se reservan con al menos un día de anticipación (hasta las ${settings.cutoff_time} del día anterior) y hasta ${settings.days_ahead} días más`,
      { date: 'Día no disponible' },
    );
  }
  if (day.closed) throw AppError.badRequest(day.closed, { date: day.closed });
  const block = activeBlocks(settings).find((b) => b.start === start);
  if (!block) throw AppError.badRequest('Ese horario no está disponible', { start: 'Horario no disponible' });
  return block;
}

async function countsBySlot(siteId, from, to, db = { query }) {
  const { rows } = await db.query(
    `SELECT to_char(visit_date, 'YYYY-MM-DD') AS date, to_char(start_time, 'HH24:MI') AS start, count(*)::int AS n
       FROM visit_bookings
      WHERE site_id = $1 AND visit_date BETWEEN $2 AND $3 AND status IN ${ACTIVE}
      GROUP BY 1, 2`,
    [siteId, from, to],
  );
  return new Map(rows.map((r) => [`${r.date} ${r.start}`, r.n]));
}

async function getSettingsOrThrow({ publicSite = false } = {}) {
  const settings = await getSetting('bookings');
  if (publicSite && !settings.enabled) {
    throw new AppError(503, 'Las reservas en línea no están disponibles por ahora. Comunícate con la residencia.');
  }
  return settings;
}

// --- Datos que se muestran en la página pública (mínimos, por la ley de datos personales) ---

const normalizeText = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-zñ\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);

/** "María Angélica" + "González Pérez" → "María G." */
export const shortName = (first, last) => `${String(first).trim().split(/\s+/)[0]} ${String(last).trim().charAt(0).toUpperCase()}.`;

/** "juanperez@gmail.com" → "ju*******@g****.com" */
export function maskEmail(email) {
  if (!email) return null;
  const [user, domain] = email.split('@');
  const dot = domain.lastIndexOf('.');
  const host = dot > 0 ? domain.slice(0, dot) : domain;
  const tld = dot > 0 ? domain.slice(dot) : '';
  return `${user.slice(0, Math.min(3, Math.max(1, user.length - 2)))}${'*'.repeat(Math.max(3, user.length - 3))}@${host.charAt(0)}${'*'.repeat(Math.max(3, host.length - 1))}${tld}`;
}

/** "+56912345678" → "+56 9 **** **78" */
export const maskPhone = (phone) => (phone ? `+56 9 **** **${phone.slice(-2)}` : null);

async function findGuardianByDoc({ doc_type: docType, doc_number: docNumber }) {
  if (docType !== 'RUT') return null;
  const { rows } = await query(
    `SELECT g.id, g.full_name, g.email, g.phone,
            COALESCE((
              SELECT json_agg(json_build_object(
                'id', r.id, 'first_name', r.first_name, 'last_name', r.last_name, 'site_id', r.site_id, 'site_name', s.name
              ) ORDER BY r.first_name)
              FROM resident_guardians rg
              JOIN residents r ON r.id = rg.resident_id AND r.is_active
              JOIN sites s ON s.id = r.site_id
              WHERE rg.guardian_id = g.id
            ), '[]'::json) AS residents
       FROM guardians g
      WHERE g.rut = $1 AND g.is_active`,
    [docNumber],
  );
  return rows[0] ?? null;
}

// --- Página pública ---

export async function getPublicConfig() {
  const settings = await getSettingsOrThrow();
  const { rows: sites } = await query('SELECT id, name FROM sites ORDER BY id');
  return { enabled: settings.enabled, cutoff_time: settings.cutoff_time, days_ahead: settings.days_ahead, limits: limitsOf(settings), sites };
}

// --- Límites de la página pública (configurables en Soporte) ---

export const DEFAULT_LIMITS = { per_person_day: 1, per_person_week: 3, per_resident_day: 2 };
const limitsOf = (settings) => ({ ...DEFAULT_LIMITS, ...(settings.limits ?? {}) });

/**
 * Una "persona" es el mismo documento o el mismo teléfono (así no se esquiva cambiando el pasaporte).
 * Solo cuentan las reservas vigentes; cancelar o que el equipo rechace libera el cupo.
 */
async function assertPublicLimits(client, limits, { now, date, docType, docNumber, phone, residentId }) {
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`booking-person:${docType}:${docNumber}`]);
  const { rows } = await client.query(
    `SELECT count(*) FILTER (WHERE visit_date = $4)::int AS same_day,
            count(*)::int AS upcoming
       FROM visit_bookings
      WHERE status IN ${ACTIVE} AND visit_date >= $5
        AND ((doc_type = $1 AND doc_number = $2) OR ($3::text IS NOT NULL AND phone = $3))`,
    [docType, docNumber, phone ?? null, date, now.date],
  );
  if (rows[0].same_day >= limits.per_person_day) {
    throw AppError.conflict(
      limits.per_person_day === 1
        ? 'Ya tienes una visita reservada para ese día. Elige otro día.'
        : `Ya tienes el máximo de ${limits.per_person_day} visitas para ese día. Elige otro día.`,
    );
  }
  if (rows[0].upcoming >= limits.per_person_week) {
    throw AppError.conflict(
      `Ya tienes ${limits.per_person_week} visitas reservadas, que es el máximo por semana. Si necesitas otro horario, cancela una primero.`,
    );
  }
  if (residentId) {
    const { rows: r } = await client.query(
      `SELECT count(*)::int AS n FROM visit_bookings WHERE status IN ${ACTIVE} AND resident_id = $1 AND visit_date = $2`,
      [residentId, date],
    );
    if (r[0].n >= limits.per_resident_day) {
      throw AppError.conflict('Ese día ya tiene el máximo de visitas para esta persona. Elige otro día.');
    }
  }
}

/** Días y bloques con cupo de una sede. `staff` = vista del equipo (desde hoy, sin hora límite). */
export async function getAvailability(siteId, { staff = false } = {}) {
  const settings = await getSettingsOrThrow({ publicSite: !staff });
  const now = await chileNow();
  const days = bookableDays(settings, now, { staff });
  const counts = await countsBySlot(siteId, days[0].date, days.at(-1).date);
  return {
    today: now.date,
    days: days.map((d) => ({
      ...d,
      slots: d.closed
        ? []
        : activeBlocks(settings).map((b) => ({
            start: b.start,
            end: b.end,
            capacity: b.capacity,
            remaining: Math.max(0, b.capacity - (counts.get(`${d.date} ${b.start}`) ?? 0)),
          })),
    })),
  };
}

/** Si el RUT es de un apoderado registrado devuelve sus datos enmascarados y sus residentes (nombre corto). */
export async function lookupVisitor(doc) {
  await getSettingsOrThrow({ publicSite: true });
  const guardian = await findGuardianByDoc(doc);
  if (!guardian) return { found: false };
  return {
    found: true,
    guardian: {
      display_name: shortName(...splitFullName(guardian.full_name)),
      email: maskEmail(guardian.email),
      phone: maskPhone(guardian.phone),
    },
    residents: guardian.residents.map((r) => ({
      id: r.id,
      label: shortName(r.first_name, r.last_name),
      site_id: r.site_id,
      site_name: r.site_name,
    })),
  };
}

function splitFullName(fullName) {
  const parts = String(fullName).trim().split(/\s+/);
  return [parts[0], parts.slice(1).join(' ') || parts[0]];
}

/** Busca un único residente activo de la sede cuyo nombre contenga todas las palabras escritas. */
async function matchResident(siteId, typed) {
  const words = normalizeText(typed).filter((w) => w.length >= 2);
  if (words.length < 2) return null;
  const { rows } = await query('SELECT id, first_name, last_name FROM residents WHERE site_id = $1 AND is_active', [siteId]);
  const matches = rows.filter((r) => {
    const own = new Set(normalizeText(`${r.first_name} ${r.last_name}`));
    return words.every((w) => own.has(w));
  });
  return matches.length === 1 ? matches[0].id : null;
}

function newCode() {
  return Array.from({ length: 6 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
}

/**
 * Inserta con bloqueo por (sede, día, bloque) para que dos personas no tomen el último cupo a la vez.
 * `beforeInsert(client)` corre dentro de la misma transacción (límites por persona / residente).
 */
async function insertBooking(row, block, beforeInsert) {
  return withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`booking:${row.site_id}:${row.visit_date}:${block.start}`]);
    if (beforeInsert) await beforeInsert(client);
    const counts = await countsBySlot(row.site_id, row.visit_date, row.visit_date, client);
    if ((counts.get(`${row.visit_date} ${block.start}`) ?? 0) >= block.capacity) {
      throw AppError.conflict('Ese bloque se acaba de llenar. Elige otro horario.');
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newCode();
      try {
        await client.query('SAVEPOINT ins');
        const { rows } = await client.query(
          `INSERT INTO visit_bookings
             (code, site_id, resident_id, resident_name_input, guardian_id, visit_date, start_time, end_time,
              doc_type, doc_number, visitor_name, phone, status, source, created_by, ip, relationship)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
           RETURNING id, code`,
          [
            code, row.site_id, row.resident_id, row.resident_name_input, row.guardian_id, row.visit_date, block.start, block.end,
            row.doc_type, row.doc_number, row.visitor_name, row.phone, row.status, row.source, row.created_by ?? null, row.ip ?? null,
            row.relationship ?? null,
          ],
        );
        return rows[0];
      } catch (err) {
        await client.query('ROLLBACK TO SAVEPOINT ins');
        if (err.code === '23505' && err.constraint === 'uq_visit_bookings_person_slot') {
          throw AppError.conflict('Ya tienes una reserva en ese día y horario.');
        }
        if (!(err.code === '23505' && err.constraint === 'visit_bookings_code_key')) throw err;
      }
    }
    throw new AppError(500, 'No se pudo generar el código de reserva. Intenta nuevamente.');
  });
}

export async function createPublicBooking(input, ip) {
  const settings = await getSettingsOrThrow({ publicSite: true });
  const now = await chileNow();
  const block = assertSlot(settings, now, input.date, input.start);

  const guardian = await findGuardianByDoc(input);
  let row;
  let residentLabel;
  if (guardian) {
    const resident = guardian.residents.find((r) => r.id === input.resident_id);
    if (!resident) throw AppError.badRequest('Selecciona a quién visitas', { resident_id: 'Selecciona a quién visitas' });
    row = {
      site_id: resident.site_id,
      resident_id: resident.id,
      resident_name_input: null,
      guardian_id: guardian.id,
      visitor_name: guardian.full_name,
      phone: guardian.phone,
    };
    residentLabel = shortName(resident.first_name, resident.last_name);
  } else {
    const errors = {};
    if (!input.first_name) errors.first_name = 'Ingresa tu nombre';
    if (!input.last_name) errors.last_name = 'Ingresa tu apellido';
    if (!input.phone) errors.phone = 'Ingresa tu teléfono';
    if (!input.site_id) errors.site_id = 'Selecciona la sede';
    if (!input.resident_name || normalizeText(input.resident_name).length < 2) errors.resident_name = 'Escribe el nombre y apellido del residente';
    if (Object.keys(errors).length) throw AppError.badRequest('Datos inválidos', errors);
    const { rowCount } = await query('SELECT 1 FROM sites WHERE id = $1', [input.site_id]);
    if (!rowCount) throw AppError.badRequest('Datos inválidos', { site_id: 'Selecciona la sede' });
    row = {
      site_id: input.site_id,
      // No se le dice al visitante si el residente existe: el equipo lo revisa en el panel
      resident_id: await matchResident(input.site_id, input.resident_name),
      resident_name_input: input.resident_name,
      guardian_id: null,
      visitor_name: `${input.first_name} ${input.last_name}`,
      phone: input.phone,
    };
    residentLabel = input.resident_name;
  }

  const saved = await insertBooking(
    { ...row, visit_date: input.date, doc_type: input.doc_type, doc_number: input.doc_number, status: 'BOOKED', source: 'PUBLIC', ip },
    block,
    (client) =>
      assertPublicLimits(client, limitsOf(settings), {
        now,
        date: input.date,
        docType: input.doc_type,
        docNumber: input.doc_number,
        phone: row.phone,
        // Solo para apoderados verificados: con visitantes no verificados avisar "ese residente ya tiene
        // visitas" revelaría que el residente existe
        residentId: guardian ? row.resident_id : null,
      }),
  );
  const { rows } = await query('SELECT name FROM sites WHERE id = $1', [row.site_id]);
  return { code: saved.code, date: input.date, start: block.start, end: block.end, site_name: rows[0].name, resident_label: residentLabel };
}

/** El visitante cancela con código + documento, hasta antes de que empiece el bloque. */
export async function cancelPublicBooking({ code, doc_number: docNumber }) {
  const { rows } = await query(
    `UPDATE visit_bookings SET status = 'CANCELLED', cancelled_at = now()
      WHERE code = $1 AND doc_number = $2 AND status IN ${ACTIVE}
        AND (visit_date + start_time) > (now() AT TIME ZONE 'America/Santiago')
      RETURNING to_char(visit_date, 'YYYY-MM-DD') AS date, to_char(start_time, 'HH24:MI') AS start`,
    [code, docNumber],
  );
  if (!rows[0]) throw AppError.notFound('No encontramos una reserva vigente con ese código y documento.');
  return rows[0];
}

// --- Panel interno ---

const BOOKING_COLUMNS = `
  b.id, b.code, b.site_id, s.name AS site_name, to_char(b.visit_date, 'YYYY-MM-DD') AS visit_date,
  to_char(b.start_time, 'HH24:MI') AS start, to_char(b.end_time, 'HH24:MI') AS "end",
  b.doc_type, b.doc_number, b.visitor_name, b.relationship, b.phone, b.status, b.source, b.reject_reason,
  b.resident_name_input, b.resident_id, r.first_name AS resident_first_name, r.last_name AS resident_last_name,
  r.room AS resident_room, r.bed AS resident_bed,
  b.guardian_id, rg.relationship AS guardian_relationship,
  b.created_at, b.reviewed_at, ru.full_name AS reviewed_by_name, cu.full_name AS created_by_name,
  CASE WHEN b.guardian_id IS NOT NULL AND rg.guardian_id IS NOT NULL THEN 'GUARDIAN'
       WHEN b.resident_id IS NOT NULL THEN 'MATCHED'
       ELSE 'UNMATCHED' END AS verification`;

const BOOKING_FROM = `
  FROM visit_bookings b
  JOIN sites s ON s.id = b.site_id
  LEFT JOIN residents r ON r.id = b.resident_id
  LEFT JOIN resident_guardians rg ON rg.guardian_id = b.guardian_id AND rg.resident_id = b.resident_id
  LEFT JOIN users ru ON ru.id = b.reviewed_by
  LEFT JOIN users cu ON cu.id = b.created_by`;

export async function listDay({ site_id: siteId, date }) {
  const settings = await getSettingsOrThrow();
  const now = await chileNow();
  const day = date ?? now.date;
  const params = [day];
  let siteFilter = '';
  if (siteId) {
    params.push(siteId);
    siteFilter = `AND b.site_id = $${params.length}`;
  }
  const { rows: bookings } = await query(
    `SELECT ${BOOKING_COLUMNS} ${BOOKING_FROM}
      WHERE b.visit_date = $1 ${siteFilter}
      ORDER BY b.start_time, s.name, (b.status IN ${ACTIVE}) DESC, b.created_at`,
    params,
  );
  // Por revisar desde hoy en adelante (para avisar en otros días)
  const pendingParams = [now.date, ...(siteId ? [siteId] : [])];
  const { rows: pending } = await query(
    `SELECT to_char(visit_date, 'YYYY-MM-DD') AS date, count(*)::int AS n
       FROM visit_bookings b
      WHERE visit_date >= $1 AND status = 'BOOKED' ${siteId ? 'AND site_id = $2' : ''}
      GROUP BY 1 ORDER BY 1`,
    pendingParams,
  );
  const blocked = settings.blocked_dates.find((d) => d.date === day);
  return {
    date: day,
    today: now.date,
    days_ahead: settings.days_ahead,
    blocked: blocked ? blocked.reason || 'Sin visitas este día' : null,
    blocks: activeBlocks(settings).map(({ start, end, capacity }) => ({ start, end, capacity })),
    bookings,
    pending,
  };
}

export async function createStaffBooking(input, user) {
  const settings = await getSettingsOrThrow();
  const now = await chileNow();
  const block = assertSlot(settings, now, input.date, input.start, { staff: true });
  const { rows } = await query('SELECT id, site_id FROM residents WHERE id = $1 AND is_active', [input.resident_id]);
  if (!rows[0]) throw AppError.badRequest('Datos inválidos', { resident_id: 'Selecciona un residente activo' });

  // Apoderado: solo uno de ese residente; se copian sus datos (nombre, teléfono, RUT)
  let visitor = { guardian_id: null, visitor_name: input.visitor_name, relationship: input.relationship, phone: input.phone ?? null, rut: null };
  if (input.guardian_id) {
    const link = await query(
      `SELECT g.id, g.full_name, g.phone, g.rut FROM guardians g JOIN resident_guardians rg ON rg.guardian_id = g.id
        WHERE g.id = $1 AND rg.resident_id = $2`,
      [input.guardian_id, input.resident_id],
    );
    const g = link.rows[0];
    if (!g) throw AppError.badRequest('Ese apoderado no está asociado al residente', { guardian_id: 'Apoderado inválido' });
    visitor = { guardian_id: g.id, visitor_name: g.full_name, relationship: null, phone: g.phone, rut: g.rut };
  }

  const saved = await insertBooking(
    {
      site_id: rows[0].site_id,
      resident_id: rows[0].id,
      resident_name_input: null,
      guardian_id: visitor.guardian_id,
      visit_date: input.date,
      doc_type: visitor.rut ? 'RUT' : 'OTRO',
      doc_number: visitor.rut,
      visitor_name: visitor.visitor_name,
      relationship: visitor.relationship,
      phone: visitor.phone,
      status: 'CONFIRMED',
      source: 'STAFF',
      created_by: user.id,
    },
    block,
  );
  return getBooking(saved.id);
}

export async function getBooking(id) {
  const { rows } = await query(`SELECT ${BOOKING_COLUMNS} ${BOOKING_FROM} WHERE b.id = $1`, [id]);
  if (!rows[0]) throw AppError.notFound('Reserva no encontrada');
  return rows[0];
}

export async function confirmBooking(id, user) {
  const { rowCount } = await query(
    `UPDATE visit_bookings SET status = 'CONFIRMED', reviewed_by = $2, reviewed_at = now()
      WHERE id = $1 AND status = 'BOOKED'`,
    [id, user.id],
  );
  if (!rowCount) throw AppError.conflict('La reserva ya no está pendiente de revisión.');
  return getBooking(id);
}

export async function rejectBooking(id, { reason }, user) {
  const { rowCount } = await query(
    `UPDATE visit_bookings SET status = 'REJECTED', reject_reason = $2, reviewed_by = $3, reviewed_at = now()
      WHERE id = $1 AND status IN ${ACTIVE}`,
    [id, reason, user.id],
  );
  if (!rowCount) throw AppError.conflict('La reserva ya estaba rechazada o cancelada.');
  return getBooking(id);
}

/**
 * Retención (ley de datos personales): a los 12 meses se borran los datos de quienes
 * no son apoderados registrados. Lo llama la limpieza diaria del servidor.
 */
export async function anonymizeOldBookings() {
  await query(
    `UPDATE visit_bookings
        SET visitor_name = 'Anonimizado', phone = NULL, doc_number = NULL, resident_name_input = CASE WHEN resident_id IS NULL THEN '—' END,
            ip = NULL, anonymized_at = now()
      WHERE anonymized_at IS NULL AND guardian_id IS NULL AND visit_date < current_date - interval '12 months'`,
  );
  await query(`UPDATE visit_bookings SET ip = NULL WHERE ip IS NOT NULL AND visit_date < current_date - interval '12 months'`);
}
