import { Router } from 'express';
import { query } from '../../db/pool.js';
import { verifyToken } from '../../middlewares/auth.js';

export const sitesRouter = Router();

sitesRouter.get('/', verifyToken, async (_req, res) => {
  const { rows } = await query('SELECT id, code, name FROM sites ORDER BY name');
  res.json({ data: rows });
});
