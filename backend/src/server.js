import fs from 'node:fs/promises';
import { env } from './config/env.js';
import { pool, waitForDb } from './db/pool.js';
import { runMigrations } from './db/migrate.js';
import { createApp } from './app.js';
import { ensureInitialAdmin } from './modules/users/users.service.js';

async function main() {
  await waitForDb();
  await runMigrations();
  await ensureInitialAdmin(env.admin);
  await fs.mkdir(env.uploadDir, { recursive: true });

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
