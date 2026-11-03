import multer from 'multer';
import { AppError } from '../utils/AppError.js';

const UNIQUE_MESSAGES = {
  residents_rut_key: 'Ya existe un residente con ese RUT',
  uq_residents_active_bed: 'Esa cama ya está asignada a otro residente activo',
  users_email_key: 'Ya existe un usuario con ese correo',
  resident_guardians_rut_key: 'Los dos apoderados no pueden tener el mismo RUT',
  resident_guardians_position_key: 'Un residente puede tener máximo 2 apoderados',
};

const CHECK_MESSAGES = {
  residents_guardian_required: 'El residente debe tener al menos un apoderado',
  resident_guardians_position_check: 'Un residente puede tener máximo 2 apoderados',
};

export function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
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
  if (err.code === '23514' || err.code === '22007' || err.code === '22008') {
    return res.status(400).json({ error: CHECK_MESSAGES[err.constraint] || 'Datos inválidos' });
  }

  console.error('[error]', err);
  res.status(500).json({ error: 'Error interno del servidor' });
}
