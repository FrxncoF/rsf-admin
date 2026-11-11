import { api } from '@/lib/api';

export const guardiansApi = {
  list: (params, opts) => api.get('/guardians', { params, ...opts }),
  get: (id) => api.get(`/guardians/${id}`).then((r) => r.data),
  create: (body) => api.post('/guardians', body).then((r) => r.data),
  update: (id, body) => api.put(`/guardians/${id}`, body).then((r) => r.data),
  setStatus: (id, isActive) => api.patch(`/guardians/${id}/status`, { is_active: isActive }).then((r) => r.data),
};
