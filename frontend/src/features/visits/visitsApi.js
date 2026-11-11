import { api } from '@/lib/api';

export const visitsApi = {
  list: (params, opts) => api.get('/visits', { params, ...opts }),
  create: (body) => api.post('/visits', body).then((r) => r.data),
  remove: (id) => api.delete(`/visits/${id}`),
};
