import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { verifyToken } from '../../middlewares/auth.js';
import { parse } from '../../utils/validation.js';
import { loginSchema, updateProfileSchema } from './auth.validators.js';
import { authenticate, cookieOptions, signAccessToken, updateOwnProfile } from './auth.service.js';
import { env } from '../../config/env.js';

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: { error: 'Demasiados intentos. Intenta nuevamente en unos minutos.' },
});

authRouter.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const user = await authenticate(email, password);
  const token = signAccessToken(user);

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
  res.json({ user: await updateOwnProfile(req.user, changes) });
});
