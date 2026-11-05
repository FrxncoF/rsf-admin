import { Router } from 'express';
import { verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse, parseId } from '../../utils/validation.js';
import { guardianListQuerySchema, guardianSchema } from './guardians.validators.js';
import * as guardians from './guardians.service.js';

export const guardiansRouter = Router();

// Datos de contacto de terceros: gestión exclusiva ADMIN.
// La cuidadora ve nombre y teléfono del apoderado desde la ficha del residente.
guardiansRouter.use(verifyToken, verifyRole([ROLES.ADMIN]));

guardiansRouter.get('/', async (req, res) => {
  res.json(await guardians.listGuardians(parse(guardianListQuerySchema, req.query)));
});

guardiansRouter.get('/:id', async (req, res) => {
  res.json({ data: await guardians.getGuardian(parseId(req.params)) });
});

guardiansRouter.post('/', async (req, res) => {
  const input = parse(guardianSchema, req.body);
  res.status(201).json({ data: await guardians.createGuardian(input, req.user.id) });
});

guardiansRouter.put('/:id', async (req, res) => {
  const id = parseId(req.params);
  const input = parse(guardianSchema, req.body);
  res.json({ data: await guardians.updateGuardian(id, input, req.user.id) });
});

guardiansRouter.delete('/:id', async (req, res) => {
  await guardians.deleteGuardian(parseId(req.params));
  res.status(204).end();
});
