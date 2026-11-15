import { Router } from 'express';
import { verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse, parseId } from '../../utils/validation.js';
import { recordDoseSchema, scheduleQuerySchema } from './medications.validators.js';
import * as medications from './medications.service.js';

export const medicationsRouter = Router();

// Pastillero y registro de dosis: lo usan ambos roles a diario
medicationsRouter.use(verifyToken, verifyRole([ROLES.ADMIN, ROLES.CUIDADORA]));

medicationsRouter.get('/schedule', async (req, res) => {
  res.json({ data: await medications.getSchedule(parse(scheduleQuerySchema, req.query)) });
});

medicationsRouter.put('/doses', async (req, res) => {
  res.json({ data: await medications.recordDose(parse(recordDoseSchema, req.body), req.user) });
});

medicationsRouter.delete('/doses/:id', async (req, res) => {
  await medications.deleteDose(parseId(req.params));
  res.status(204).end();
});
