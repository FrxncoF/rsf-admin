import multer from 'multer';
import { AppError } from '../utils/AppError.js';
import { query } from '../db/pool.js';

const UNIQUE_MESSAGES = {
  residents_rut_key: 'Ya existe un residente con ese RUT',
  uq_residents_active_bed: 'Esa cama ya está asignada a otro residente activo en esta sede',
  users_email_key: 'Ya existe un usuario con ese correo',
  guardians_rut_key: 'Ya existe un apoderado con ese RUT: búscalo y selecciónalo (si está desactivado, reactívalo en Apoderados)',
  resident_guardians_pkey: 'No puedes asignar el mismo apoderado dos veces',
  resident_guardians_position_key: 'Un residente puede tener máximo 2 apoderados',
  uq_resident_conditions_name: 'Esa patología ya está registrada',
};

const CHECK_MESSAGES = {
  residents_guardian_required: 'El residente debe tener al menos un apoderado',
  resident_guardians_position_check: 'Un residente puede tener máximo 2 apoderados',
  residents_admission_after_birth: 'El ingreso no puede ser antes del nacimiento',
  residents_isapre_matches_system: 'Selecciona la isapre',
};

const FOREIGN_KEY_MESSAGES = {
  residents_site_id_fkey: 'La sede seleccionada no existe',
  resident_guardians_guardian_fkey: 'El apoderado seleccionado no existe',
};

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

/** Guarda el error para la sección Soporte. Nunca debe romper la respuesta. */
function logError(err, req) {
  query(
    `INSERT INTO error_logs (method, path, user_id, user_email, ip, message, stack)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      req.method,
      req.originalUrl?.slice(0, 300),
      req.user?.id ?? null,
      req.user?.email ?? null,
      req.ip,
      String(err?.message ?? err).slice(0, 2000),
      err?.stack?.slice(0, 8000) ?? null,
    ],
  ).catch((e) => console.error('[error] no se pudo registrar el error:', e.message));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'La imagen supera el tamaño máximo (5 MB)' : 'Archivo inválido';
    return res.status(400).json({ error: message });
  }

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'JSON inválido' });
  }

  // Errores de PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({ error: UNIQUE_MESSAGES[err.constraint] || 'Registro duplicado' });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: FOREIGN_KEY_MESSAGES[err.constraint] || 'Referencia inválida' });
  }
  if (err.code === '23514' || err.code === '22007' || err.code === '22008') {
    return res.status(400).json({ error: CHECK_MESSAGES[err.constraint] || 'Datos inválidos' });
  }

  console.error('[error]', err);
  logError(err, req);
  res.status(500).json({ error: 'Error interno del servidor' });
}
