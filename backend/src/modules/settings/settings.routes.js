import { Router } from 'express';
import { getPublicSettings } from './settings.service.js';

export const settingsRouter = Router();

// Sin sesión: el aviso superior también se muestra en el login. No contiene datos sensibles.
settingsRouter.get('/public', async (_req, res) => {
  res.json({ data: await getPublicSettings() });
});
