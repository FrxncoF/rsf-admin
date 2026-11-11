import { z } from 'zod';

// Se puede agendar hasta 30 días adelante (+1 de margen por zona horaria) o registrar hasta 1 año atrás
const MAX_AHEAD_MS = 31 * 24 * 60 * 60 * 1000;
const MAX_AGE_MS = 366 * 24 * 60 * 60 * 1000;

// Horario de visitas (hora de Chile): 09:00 a 20:00, en bloques de 30 minutos
const VISIT_FROM = '09:00';
const VISIT_TO = '20:00';
const chileTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: process.env.TZ || 'America/Santiago',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});
const inVisitingHours = (iso) => {
  const time = chileTime.format(new Date(iso));
  return time >= VISIT_FROM && time <= VISIT_TO && /:(00|30)$/.test(time);
};

export const createVisitSchema = z
  .object({
    site_id: z.coerce.number({ message: 'Selecciona la sede' }).int().positive('Selecciona la sede'),
    resident_id: z.string({ message: 'Selecciona el residente' }).uuid('Selecciona el residente'),
    // Apoderado del residente, o bien el nombre de otra persona
    guardian_id: z.string().uuid('Apoderado inválido').nullish(),
    visitor_name: z.string().trim().max(120, 'Máximo 120 caracteres').nullish(),
    relationship: z.string().trim().max(40, 'Máximo 40 caracteres').nullish(),
    visit_at: z
      .string({ message: 'Indica la fecha y hora' })
      .datetime({ offset: true, message: 'Fecha y hora inválidas' })
      .refine((v) => new Date(v).getTime() <= Date.now() + MAX_AHEAD_MS, 'Se puede agendar hasta 30 días adelante')
      .refine((v) => new Date(v).getTime() >= Date.now() - MAX_AGE_MS, 'La fecha es de hace más de un año')
      .refine(inVisitingHours, 'El horario de visitas es de 09:00 a 20:00'),
  })
  .refine((v) => Boolean(v.guardian_id) !== Boolean(v.visitor_name), {
    message: 'Selecciona un apoderado o escribe el nombre de quien visita',
    path: ['visitor_name'],
  });

export const listVisitsQuerySchema = z.object({
  site_id: z.coerce.number().int().positive().optional(),
  resident_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(30),
});
