import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.js';
import { getUf } from './uf.service.js';

export const indicatorsRouter = Router();

indicatorsRouter.get('/uf', verifyToken, async (_req, res) => {
  res.json({ data: await getUf() });
});
