import fs from 'node:fs/promises';
import { env } from './config/env.js';
import { pool, waitForDb } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';
import { ensureInitialAdmin, ensureInitialSupport } from './modules/users/users.service.js';
import { pruneLogs } from './modules/support/support.service.js';
import { scheduleDailyBackup } from './modules/support/backups.service.js';

async function main() {
  await waitForDb();
  await runMigrations();
  await ensureInitialAdmin(env.admin);
  await ensureInitialSupport(env.support);
  await fs.mkdir(env.uploadDir, { recursive: true });

  // Mantención: registros técnicos de más de 180 días y respaldo diario de la BD
  const prune = () => pruneLogs().catch((err) => console.warn('[mantención] limpieza falló:', err.message));
  prune();
  setInterval(prune, 24 * 60 * 60 * 1000).unref();
  scheduleDailyBackup();

  const server = createApp().listen(env.port, () => {
    console.log(`[api] escuchando en :${env.port} (${env.nodeEnv})`);
  });

  const shutdown = (signal) => {
    console.log(`[api] ${signal} recibido, cerrando...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[api] error fatal al iniciar', err);
  process.exit(1);
});
