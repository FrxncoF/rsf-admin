import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { residentsRouter } from './modules/residents/residents.routes.js';
import { usersRouter } from './modules/users/users.routes.js';
import { guardiansRouter } from './modules/guardians/guardians.routes.js';
import { sitesRouter } from './modules/sites/sites.routes.js';
import { indicatorsRouter } from './modules/indicators/indicators.routes.js';
import { dailyLogsRouter } from './modules/daily-logs/dailyLogs.routes.js';
import { visitsRouter } from './modules/visits/visits.routes.js';
import { settingsRouter } from './modules/settings/settings.routes.js';
import { supportRouter } from './modules/support/support.routes.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Cantidad de proxies delante (Nginx = 1; Caddy + Nginx = 2): IP real para rate-limit y registro de accesos
  app.set('trust proxy', Number(process.env.TRUST_PROXY || 1));

  app.use(helmet());
  app.use(
    cors({
      // Sin CORS_ORIGINS solo se aceptan peticiones del mismo origen (Nginx hace de proxy)
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin)),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  const api = express.Router();

  api.get('/health', async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok' });
  });

  api.use('/auth', authRouter);
  api.use('/residents', residentsRouter);
  api.use('/users', usersRouter);
  api.use('/guardians', guardiansRouter);
  api.use('/sites', sitesRouter);
  api.use('/indicators', indicatorsRouter);
  api.use('/daily-logs', dailyLogsRouter);
  api.use('/visits', visitsRouter);
  api.use('/settings', settingsRouter);
  api.use('/support', supportRouter);

  app.use('/api', api);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
