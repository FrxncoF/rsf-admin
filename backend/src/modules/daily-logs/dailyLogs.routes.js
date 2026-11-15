import { Router } from 'express';
import { verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse, parseId } from '../../utils/validation.js';
import { currentQuerySchema, listDailyLogsQuerySchema, noteSchema, saveCurrentSchema, saveLogSchema } from './dailyLogs.validators.js';
import * as dailyLogs from './dailyLogs.service.js';

export const dailyLogsRouter = Router();

// Ficha por turno: se completa durante el turno (guardado parcial) y se cierra al terminar.
// Nada se borra: cada cambio queda en el historial y las correcciones posteriores van como notas.
dailyLogsRouter.use(verifyToken, verifyRole([ROLES.ADMIN, ROLES.CUIDADORA]));

dailyLogsRouter.get('/', async (req, res) => {
  res.json(await dailyLogs.listDailyLogs(parse(listDailyLogsQuerySchema, req.query), req.user));
});

dailyLogsRouter.get('/current', async (req, res) => {
  res.json({ data: await dailyLogs.getCurrent(parse(currentQuerySchema, req.query), req.user) });
});

dailyLogsRouter.put('/current', async (req, res) => {
  res.json({ data: await dailyLogs.saveCurrent(parse(saveCurrentSchema, req.body), req.user) });
});

dailyLogsRouter.get('/:id', async (req, res) => {
  res.json({ data: await dailyLogs.getDailyLog(parseId(req.params), req.user) });
});

dailyLogsRouter.patch('/:id', async (req, res) => {
  res.json({ data: await dailyLogs.saveLog(parseId(req.params), parse(saveLogSchema, req.body), req.user) });
});

dailyLogsRouter.get('/:id/changes', async (req, res) => {
  res.json({ data: await dailyLogs.listChanges(parseId(req.params), req.user) });
});

dailyLogsRouter.post('/:id/notes', async (req, res) => {
  const id = parseId(req.params);
  res.status(201).json({ data: await dailyLogs.addNote(id, parse(noteSchema, req.body), req.user) });
});
