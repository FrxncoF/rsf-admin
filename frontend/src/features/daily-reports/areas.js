import { api } from '@/lib/api';

// Áreas (deben coincidir con backend/src/modules/daily-reports/dailyReports.validators.js)
export const AREAS = [
  { value: 'KINESIOLOGIA', label: 'Kinesiología', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
  { value: 'TERAPIA_OCUPACIONAL', label: 'Terapia Ocupacional', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
  { value: 'ENFERMERIA', label: 'Enfermería', className: 'bg-rose-50 text-rose-800 ring-rose-200' },
  { value: 'ENCARGADA_TURNO', label: 'Encargada de turno', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
];

export const areaOf = (value) => AREAS.find((a) => a.value === value) ?? { value, label: value, className: '' };

export const dailyReportsApi = {
  list: (params) => api.get('/daily-reports', { params }),
  create: (body) => api.post('/daily-reports', body).then((r) => r.data),
  update: (id, body) => api.patch(`/daily-reports/${id}`, body).then((r) => r.data),
};
