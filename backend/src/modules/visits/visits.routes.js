import { Router } from 'express';
import { hasAdminAccess, verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse, parseId } from '../../utils/validation.js';
import { createVisitSchema, listVisitsQuerySchema } from './visits.validators.js';
import * as visits from './visits.service.js';

export const visitsRouter = Router();

// Ambos roles ven y registran visitas; solo ADMIN elimina (para corregir errores)
visitsRouter.use(verifyToken, verifyRole([ROLES.ADMIN, ROLES.CUIDADORA]));

visitsRouter.get('/', async (req, res) => {
  const filters = parse(listVisitsQuerySchema, req.query);
  res.json(await visits.listVisits(filters, { isAdmin: hasAdminAccess(req.user) }));
});

visitsRouter.post('/', async (req, res) => {
  const input = parse(createVisitSchema, req.body);
  res.status(201).json({ data: await visits.createVisit(input, req.user) });
});

visitsRouter.delete('/:id', verifyRole([ROLES.ADMIN]), async (req, res) => {
  await visits.deleteVisit(parseId(req.params));
  res.status(204).end();
});
