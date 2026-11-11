import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { getUfStatus } from '../indicators/uf.service.js';
import { listBackups } from './backups.service.js';

const APP_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const MIGRATIONS_DIR = path.join(APP_ROOT, 'migrations');

/** Suma el tamaño de todos los archivos bajo `dir` (0 si no existe). */
async function dirSize(dir) {
  let total = 0;
  let files = 0;
  try {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const sub = await dirSize(full);
        total += sub.bytes;
        files += sub.files;
      } else {
        total += (await fs.stat(full)).size;
        files += 1;
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  return { bytes: total, files };
}

const readBuildDate = () => fs.readFile(path.join(APP_ROOT, 'BUILD_DATE'), 'utf8').then((s) => s.trim(), () => null);

export async function getStatus() {
  const [files, applied, dbSize, counts, photos, backups, buildDate] = await Promise.all([
    fs.readdir(MIGRATIONS_DIR).then((f) => f.filter((n) => /^\d+_.+\.sql$/.test(n)).sort()),
    query('SELECT name, applied_at FROM schema_migrations ORDER BY name').then((r) => r.rows),
    query('SELECT pg_database_size(current_database())::bigint AS bytes, version() AS version').then((r) => r.rows[0]),
    query(`
      SELECT
        (SELECT count(*) FROM error_logs WHERE created_at > now() - interval '24 hours')::int AS errors_24h,
        (SELECT count(*) FROM login_events WHERE NOT success AND created_at > now() - interval '24 hours')::int AS failed_logins_24h,
        (SELECT count(*) FROM users WHERE is_active)::int AS active_users,
        (SELECT count(*) FROM residents WHERE is_active)::int AS active_residents`).then((r) => r.rows[0]),
    dirSize(env.uploadDir),
    listBackups(),
    readBuildDate(),
  ]);

  const appliedNames = new Set(applied.map((m) => m.name));
  return {
    app: {
      version: env.appVersion || null,
      build_date: buildDate,
      node: process.version,
      uptime_seconds: Math.round(process.uptime()),
      started_at: new Date(Date.now() - process.uptime() * 1000).toISOString(),
      memory_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
    },
    migrations: {
      applied: applied.map((m) => ({ name: m.name, applied_at: m.applied_at })),
      pending: files.filter((f) => !appliedNames.has(f)),
    },
    storage: {
      database_bytes: Number(dbSize.bytes),
      postgres: dbSize.version.split(' on ')[0],
      photos_bytes: photos.bytes,
      photos_files: photos.files,
      backups_bytes: backups.reduce((sum, b) => sum + b.size, 0),
    },
    backups: { last: backups[0] ?? null, count: backups.length, keep: env.backupKeep },
    uf: getUfStatus(),
    counts,
  };
}

export async function listErrors({ page, pageSize }) {
  const { rows } = await query(
    `SELECT e.*, COUNT(*) OVER() AS total_count FROM error_logs e
      ORDER BY e.created_at DESC LIMIT $1 OFFSET $2`,
    [pageSize, (page - 1) * pageSize],
  );
  return paginate(rows, page, pageSize);
}

export async function listLogins({ search, onlyFailed, page, pageSize }) {
  const where = [];
  const params = [];
  if (onlyFailed) where.push('NOT l.success');
  if (search) {
    params.push(`%${search.toLowerCase()}%`);
    where.push(`(lower(l.email) LIKE $${params.length} OR l.ip LIKE $${params.length})`);
  }
  params.push(pageSize, (page - 1) * pageSize);
  const { rows } = await query(
    `SELECT l.*, u.full_name, COUNT(*) OVER() AS total_count
       FROM login_events l LEFT JOIN users u ON u.id = l.user_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY l.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return paginate(rows, page, pageSize);
}

function paginate(rows, page, pageSize) {
  const total = rows.length ? Number(rows[0].total_count) : 0;
  return {
    data: rows.map(({ total_count: _t, ...row }) => row),
    meta: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

/** Los registros técnicos se conservan 180 días. */
export async function pruneLogs() {
  await query(`DELETE FROM error_logs WHERE created_at < now() - interval '180 days'`);
  await query(`DELETE FROM login_events WHERE created_at < now() - interval '180 days'`);
  // Tokens revocados ya vencidos: no hace falta recordarlos
  await query('DELETE FROM revoked_tokens WHERE expires_at < now()');
}
