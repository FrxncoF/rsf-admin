import { api } from '@/lib/api';

export const dailyLogsApi = {
  list: (params, opts) => api.get('/daily-logs', { params, ...opts }),
  get: (id) => api.get(`/daily-logs/${id}`).then((r) => r.data),
  /** Turno en curso y su ficha ({ shift, shift_date, start, end, log | null }) */
  current: (residentId) => api.get('/daily-logs/current', { params: { resident_id: residentId } }).then((r) => r.data),
  /** Guarda cambios parciales en la ficha del turno en curso (la crea con el primer dato) */
  saveCurrent: (residentId, patch) => api.put('/daily-logs/current', { resident_id: residentId, patch }, { timeoutMs: 15_000 }).then((r) => r.data),
  /** Guarda cambios parciales en una ficha específica */
  save: (id, patch) => api.patch(`/daily-logs/${id}`, { patch }, { timeoutMs: 15_000 }).then((r) => r.data),
  changes: (id) => api.get(`/daily-logs/${id}/changes`).then((r) => r.data),
  addNote: (id, body) => api.post(`/daily-logs/${id}/notes`, { body }).then((r) => r.data),
};

export const SHIFT_LABEL = { DIA: 'Turno día', NOCHE: 'Turno noche' };
