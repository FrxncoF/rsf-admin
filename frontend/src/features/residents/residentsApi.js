import { api } from '@/lib/api';

export const residentsApi = {
  list: (params, opts) => api.get('/residents', { params, ...opts }),
  get: (id, opts) => api.get(`/residents/${id}`, opts).then((r) => r.data),
  create: (body) => api.post('/residents', body).then((r) => r.data),
  update: (id, body) => api.put(`/residents/${id}`, body).then((r) => r.data),
  setStatus: (id, isActive) => api.patch(`/residents/${id}/status`, { is_active: isActive }).then((r) => r.data),
  remove: (id) => api.delete(`/residents/${id}`),
  uploadPhoto: (id, file) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post(`/residents/${id}/photo`, form).then((r) => r.data);
  },
  removePhoto: (id) => api.delete(`/residents/${id}/photo`).then((r) => r.data),
  photoUrl: (resident) => `/api/residents/${resident.id}/photo?v=${encodeURIComponent(resident.updated_at)}`,
};
