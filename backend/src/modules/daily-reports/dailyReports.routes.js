import { Router } from 'express';
import { verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse, parseId } from '../../utils/validation.js';
import { createSchema, listQuerySchema, updateSchema } from './dailyReports.validators.js';
import * as reports from './dailyReports.service.js';

export const dailyReportsRouter = Router();

// Reportes Diarios: resumen general del día por sede y área. ENCARGADA y ADMIN (y SOPORTE) ven todas
// las áreas; CUIDADORA solo el reporte del turno noche (se filtra en el servicio).
// verifyRole([CUIDADORA]) también deja pasar a ENCARGADA.
dailyReportsRouter.use(verifyToken, verifyRole([ROLES.ADMIN, ROLES.CUIDADORA]));

dailyReportsRouter.get('/', async (req, res) => {
  res.json(await reports.listReports(parse(listQuerySchema, req.query), req.user));
});

dailyReportsRouter.post('/', async (req, res) => {
  res.status(201).json({ data: await reports.createReport(parse(createSchema, req.body), req.user) });
});

dailyReportsRouter.patch('/:id', async (req, res) => {
  const id = parseId(req.params);
  res.json({ data: await reports.updateReport(id, parse(updateSchema, req.body), req.user) });
});
