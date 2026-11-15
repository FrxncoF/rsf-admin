import { api } from '@/lib/api';

/** Página pública /reservar (sin sesión) */
export const publicBookingsApi = {
  config: () => api.get('/public/bookings/config').then((r) => r.data),
  availability: (siteId) => api.get('/public/bookings/availability', { params: { site_id: siteId } }).then((r) => r.data),
  lookup: (body) => api.post('/public/bookings/lookup', body).then((r) => r.data),
  create: (body) => api.post('/public/bookings', body).then((r) => r.data),
  cancel: (body) => api.post('/public/bookings/cancel', body).then((r) => r.data),
};

/** Panel interno */
export const bookingsApi = {
  day: (params) => api.get('/bookings', { params }).then((r) => r.data),
  availability: (siteId) => api.get('/bookings/availability', { params: { site_id: siteId } }).then((r) => r.data),
  create: (body) => api.post('/bookings', body).then((r) => r.data),
  confirm: (id) => api.patch(`/bookings/${id}/confirm`).then((r) => r.data),
  reject: (id, reason) => api.patch(`/bookings/${id}/reject`, { reason }).then((r) => r.data),
};

export const BOOKING_STATUS = {
  BOOKED: { label: 'Por revisar', variant: 'warning' },
  CONFIRMED: { label: 'Confirmada', variant: 'success' },
  REJECTED: { label: 'Rechazada', variant: 'danger' },
  CANCELLED: { label: 'Cancelada por el visitante', variant: 'muted' },
};

const dayFormat = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const shortFormat = new Intl.DateTimeFormat('es-CL', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

/** "2026-11-16" → "lunes 16 de noviembre" */
export const longDay = (iso) => dayFormat.format(new Date(`${iso}T12:00:00Z`)).replace(',', '');
/** "2026-11-16" → "Lunes 16 de noviembre" (solo la primera letra en mayúscula) */
export const dayTitle = (iso) => {
  const s = longDay(iso);
  return s.charAt(0).toUpperCase() + s.slice(1);
};
/** "2026-11-16" → ["lun", "16"] */
export const shortDay = (iso) => {
  const parts = shortFormat.formatToParts(new Date(`${iso}T12:00:00Z`));
  return [parts.find((p) => p.type === 'weekday')?.value.replace('.', ''), parts.find((p) => p.type === 'day')?.value];
};

export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export const MAX_FAMILY_NOTE = 'Se recomienda un máximo de 3 familiares por visita.';
export const WARNING_NOTE =
  'Si detectamos que la visita no corresponde a un residente de tu contrato o familia, la reserva se cancelará automáticamente.';
