import { api } from '@/lib/api';

// Áreas (deben coincidir con backend/src/modules/daily-reports/dailyReports.validators.js)
export const AREAS = [
  { value: 'KINESIOLOGIA', label: 'Kinesiología', className: 'bg-sky-50 text-sky-800 ring-sky-200' },
  { value: 'TERAPIA_OCUPACIONAL', label: 'Terapia Ocupacional', className: 'bg-violet-50 text-violet-800 ring-violet-200' },
  { value: 'ENFERMERIA', label: 'Enfermería', className: 'bg-rose-50 text-rose-800 ring-rose-200' },
  { value: 'ENCARGADA_TURNO', label: 'Encargada de turno', className: 'bg-amber-50 text-amber-800 ring-amber-200' },
  { value: 'TURNO_NOCHE', label: 'Turno noche', className: 'bg-indigo-50 text-indigo-800 ring-indigo-200' },
];

// Única área de las cuidadoras. Su fecha es la del día en que empieza la noche.
export const NIGHT_AREA = 'TURNO_NOCHE';

export const areaOf = (value) => AREAS.find((a) => a.value === value) ?? { value, label: value, className: '' };

/** Fecha en que se puede escribir cada área: hoy, o la noche en curso (la del 24 sigue abierta a las 02:00 del 25). */
export const openDateFor = (area, { today, night_date: nightDate }) => (area === NIGHT_AREA ? nightDate : today);

export const dailyReportsApi = {
  list: (params) => api.get('/daily-reports', { params }),
  create: (body) => api.post('/daily-reports', body).then((r) => r.data),
  update: (id, body) => api.patch(`/daily-reports/${id}`, body).then((r) => r.data),
};
