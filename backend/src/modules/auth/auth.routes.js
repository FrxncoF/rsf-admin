import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../middlewares/auth.js';
import { parse } from '../../utils/validation.js';
import { loginSchema, updateProfileSchema } from './auth.validators.js';
import { authenticate, cookieOptions, recordLogin, signAccessToken, updateOwnProfile } from './auth.service.js';
import { findUserById } from '../users/users.service.js';
import { env } from '../../config/env.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  handler: (req, res, _next, options) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : null;
    recordLogin({ email, success: false, reason: 'rate_limited', ip: req.ip, userAgent: req.get('user-agent') });
    res.status(options.statusCode).json({ error: 'Demasiados intentos. Intenta nuevamente en unos minutos.' });
  },
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const { user, tokenVersion } = await authenticate(email, password, { ip: req.ip, userAgent: req.get('user-agent') });
  const token = signAccessToken(user, tokenVersion);

  res.cookie(env.cookieName, token, cookieOptions());
  // El token también se devuelve para clientes que prefieran header Authorization
  res.json({ user, token, expiresInHours: env.jwtExpiresHours });
});

authRouter.post('/logout', (_req, res) => {
  const { maxAge: _maxAge, ...opts } = cookieOptions();
  res.clearCookie(env.cookieName, opts);
  res.status(204).end();
});

authRouter.get('/me', verifyToken, (req, res) => {
  res.json({ user: req.user });
});

authRouter.patch('/me', verifyToken, async (req, res) => {
  const changes = parse(updateProfileSchema, req.body);
  const user = await updateOwnProfile(req.user, changes);
  // Al cambiar la clave se cierran las demás sesiones; esta se renueva con el nuevo token
  if (changes.new_password) {
    const fresh = await findUserById(req.user.id);
    res.cookie(env.cookieName, signAccessToken(user, fresh.token_version), cookieOptions());
  }
  res.json({ user });
});
