import { api } from '@/lib/api';

export const dailyLogsApi = {
  list: (params, opts) => api.get('/daily-logs', { params, ...opts }),
  create: (body) => api.post('/daily-logs', body).then((r) => r.data),
  addNote: (id, body) => api.post(`/daily-logs/${id}/notes`, { body }).then((r) => r.data),
};
