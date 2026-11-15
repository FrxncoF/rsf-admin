import { api } from '@/lib/api';

export const medicationsApi = {
  schedule: (params, opts) => api.get('/medications/schedule', { params, ...opts }).then((r) => r.data),
  recordDose: (body) => api.put('/medications/doses', body).then((r) => r.data),
  removeDose: (id) => api.delete(`/medications/doses/${id}`),
};

export const DOSE_STATUS = {
  GIVEN: { label: 'Dado', className: 'bg-accent-50 text-accent-800 ring-accent-200' },
  REFUSED: { label: 'Rechazó', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  NOT_GIVEN: { label: 'No se dio', className: 'bg-red-50 text-red-700 ring-red-200' },
};
