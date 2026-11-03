import { Router } from 'express';
import { verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse, parseId } from '../../utils/validation.js';
import { createUserSchema, updateUserSchema } from './users.validators.js';
import * as users from './users.service.js';

export const usersRouter = Router();

// Gestión de cuentas: exclusivo ADMIN
usersRouter.use(verifyToken, verifyRole([ROLES.ADMIN]));

usersRouter.get('/', async (_req, res) => {
  res.json({ data: await users.listUsers() });
});

usersRouter.post('/', async (req, res) => {
  const input = parse(createUserSchema, req.body);
  res.status(201).json({ data: await users.createUser(input) });
});

usersRouter.patch('/:id', async (req, res) => {
  const id = parseId(req.params);
  const changes = parse(updateUserSchema, req.body);
  res.json({ data: await users.updateUser(id, changes, req.user) });
});
