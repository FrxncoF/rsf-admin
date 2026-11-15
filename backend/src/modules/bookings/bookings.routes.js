import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse, parseId } from '../../utils/validation.js';
import {
  availabilityQuerySchema,
  cancelSchema,
  dayQuerySchema,
  lookupSchema,
  publicBookingSchema,
  rejectSchema,
  staffBookingSchema,
} from './bookings.validators.js';
import * as bookings from './bookings.service.js';

const limiter = (windowMinutes, limit, message, extra = {}) =>
  rateLimit({
    ...extra,
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: message },
  });

// =====================================================================
// Página pública /reservar (sin sesión). Solo expone lo mínimo:
// sedes, cupos y, para un apoderado registrado, sus datos enmascarados.
// =====================================================================
export const publicBookingsRouter = Router();

// Buscar por RUT: límite estricto para que no se pueda recorrer RUTs
const lookupLimiter = limiter(15, 15, 'Demasiados intentos. Espera unos minutos e intenta nuevamente.');
// Cuenta solo reservas hechas (un error de tipeo no bloquea a la familia)
const bookingLimiter = limiter(60, 10, 'Demasiadas reservas desde esta conexión. Intenta más tarde o llama a la residencia.', {
  skipFailedRequests: true,
});
const cancelLimiter = limiter(15, 10, 'Demasiados intentos. Espera unos minutos e intenta nuevamente.');

publicBookingsRouter.get('/config', async (_req, res) => {
  res.json({ data: await bookings.getPublicConfig() });
});

publicBookingsRouter.get('/availability', async (req, res) => {
  const { site_id: siteId } = parse(availabilityQuerySchema, req.query);
  res.json({ data: await bookings.getAvailability(siteId) });
});

publicBookingsRouter.post('/lookup', lookupLimiter, async (req, res) => {
  res.json({ data: await bookings.lookupVisitor(parse(lookupSchema, req.body)) });
});

publicBookingsRouter.post('/', bookingLimiter, async (req, res) => {
  res.status(201).json({ data: await bookings.createPublicBooking(parse(publicBookingSchema, req.body), req.ip) });
});

publicBookingsRouter.post('/cancel', cancelLimiter, async (req, res) => {
  res.json({ data: await bookings.cancelPublicBooking(parse(cancelSchema, req.body)) });
});

// =====================================================================
// Panel interno: ver, confirmar, rechazar y agendar por teléfono
// =====================================================================
export const bookingsRouter = Router();
bookingsRouter.use(verifyToken, verifyRole([ROLES.ADMIN, ROLES.CUIDADORA]));

bookingsRouter.get('/', async (req, res) => {
  res.json({ data: await bookings.listDay(parse(dayQuerySchema, req.query)) });
});

bookingsRouter.get('/availability', async (req, res) => {
  const { site_id: siteId } = parse(availabilityQuerySchema, req.query);
  res.json({ data: await bookings.getAvailability(siteId, { staff: true }) });
});

bookingsRouter.post('/', async (req, res) => {
  res.status(201).json({ data: await bookings.createStaffBooking(parse(staffBookingSchema, req.body), req.user) });
});

bookingsRouter.patch('/:id/confirm', async (req, res) => {
  res.json({ data: await bookings.confirmBooking(parseId(req.params), req.user) });
});

bookingsRouter.patch('/:id/reject', async (req, res) => {
  res.json({ data: await bookings.rejectBooking(parseId(req.params), parse(rejectSchema, req.body), req.user) });
});
