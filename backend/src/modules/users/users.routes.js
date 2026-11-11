import { Router } from 'express';
import { verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse, parseId } from '../../utils/validation.js';
import { createUserSchema, updateUserSchema } from './users.validators.js';
import * as users from './users.service.js';

export const usersRouter = Router();

// Gestión de cuentas: ADMIN (sin acceso a cuentas SOPORTE) y SOPORTE
usersRouter.use(verifyToken, verifyRole([ROLES.ADMIN]));

usersRouter.get('/', async (req, res) => {
  res.json({ data: await users.listUsers(req.user) });
});

usersRouter.post('/', async (req, res) => {
  const input = parse(createUserSchema, req.body);
  res.status(201).json({ data: await users.createUser(input, req.user) });
});

// --- Solo SOPORTE ---
const supportOnly = verifyRole([ROLES.SOPORTE]);

usersRouter.post('/:id/reset-password', supportOnly, async (req, res) => {
  const id = parseId(req.params);
  res.json({ temporary_password: await users.resetPassword(id, req.user) });
});

usersRouter.post('/:id/revoke-sessions', supportOnly, async (req, res) => {
  await users.revokeSessions(parseId(req.params), req.user);
  res.status(204).end();
});

usersRouter.patch('/:id', async (req, res) => {
  const id = parseId(req.params);
  const changes = parse(updateUserSchema, req.body);
  res.json({ data: await users.updateUser(id, changes, req.user) });
});
