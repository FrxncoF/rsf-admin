import { Router } from 'express';
import { hasAdminAccess, verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse, parseId } from '../../utils/validation.js';
import { createDailyLogSchema, listDailyLogsQuerySchema, noteSchema } from './dailyLogs.validators.js';
import * as dailyLogs from './dailyLogs.service.js';

export const dailyLogsRouter = Router();

// Fichas diarias: ambos roles leen, crean y agregan notas. No hay edición ni borrado.
dailyLogsRouter.use(verifyToken, verifyRole([ROLES.ADMIN, ROLES.CUIDADORA]));

dailyLogsRouter.get('/', async (req, res) => {
  const filters = parse(listDailyLogsQuerySchema, req.query);
  res.json(await dailyLogs.listDailyLogs(filters, { isAdmin: hasAdminAccess(req.user) }));
});

dailyLogsRouter.post('/', async (req, res) => {
  const input = parse(createDailyLogSchema, req.body);
  res.status(201).json({ data: await dailyLogs.createDailyLog(input, req.user) });
});

dailyLogsRouter.post('/:id/notes', async (req, res) => {
  const id = parseId(req.params);
  const input = parse(noteSchema, req.body);
  res.status(201).json({ data: await dailyLogs.addNote(id, input, req.user) });
});
