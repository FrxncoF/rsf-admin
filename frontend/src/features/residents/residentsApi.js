import { api } from '@/lib/api';

export const residentsApi = {
  list: (params, opts) => api.get('/residents', { params, ...opts }),
  get: (id, opts) => api.get(`/residents/${id}`, opts).then((r) => r.data),
  create: (body) => api.post('/residents', body).then((r) => r.data),
  update: (id, body) => api.put(`/residents/${id}`, body).then((r) => r.data),
  setStatus: (id, isActive) => api.patch(`/residents/${id}/status`, { is_active: isActive }).then((r) => r.data),
  uploadPhoto: (id, file) => {
    const form = new FormData();
    form.append('photo', file);
    return api.post(`/residents/${id}/photo`, form).then((r) => r.data);
  },
  removePhoto: (id) => api.delete(`/residents/${id}/photo`).then((r) => r.data),
  addCondition: (id, name) => api.post(`/residents/${id}/conditions`, { name }).then((r) => r.data),
  removeCondition: (id, conditionId) => api.delete(`/residents/${id}/conditions/${conditionId}`).then((r) => r.data),
  addMedication: (id, body) => api.post(`/residents/${id}/medications`, body).then((r) => r.data),
  updateMedication: (id, medId, body) => api.put(`/residents/${id}/medications/${medId}`, body).then((r) => r.data),
  removeMedication: (id, medId) => api.delete(`/residents/${id}/medications/${medId}`).then((r) => r.data),
  photoUrl: (resident) => `/api/residents/${resident.id}/photo?v=${encodeURIComponent(resident.updated_at)}`,
};
