import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/AppError.js';

const run = promisify(execFile);
const FILE_RE = /^rsf-(\d{8})-(\d{6})-(auto|manual)\.dump$/;

// "2026-11-11 03:00:05" en hora de Chile → partes para el nombre del archivo
const chileStamp = () => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t).value;
  return { date: `${get('year')}${get('month')}${get('day')}`, time: `${get('hour')}${get('minute')}${get('second')}`, hour: Number(get('hour')) };
};

let running = null;

/** Respaldos de la BD (pg_dump formato custom). Las fotos viven en su propio volumen. */
export async function listBackups() {
  await fs.mkdir(env.backupDir, { recursive: true });
  const files = (await fs.readdir(env.backupDir)).filter((f) => FILE_RE.test(f)).sort().reverse();
  return Promise.all(
    files.map(async (name) => {
      const stat = await fs.stat(path.join(env.backupDir, name));
      return { name, size: stat.size, created_at: stat.mtime.toISOString(), kind: FILE_RE.exec(name)[3] };
    }),
  );
}

export async function createBackup(kind = 'manual') {
  if (running) throw AppError.conflict('Ya hay un respaldo en curso');
  running = (async () => {
    await fs.mkdir(env.backupDir, { recursive: true });
    const { date, time } = chileStamp();
    const name = `rsf-${date}-${time}-${kind}.dump`;
    const target = path.join(env.backupDir, name);
    try {
      // pg_dump toma la conexión de PGHOST/PGUSER/PGPASSWORD/PGDATABASE
      await run('pg_dump', ['-Fc', '--no-owner', '-f', target], { timeout: 10 * 60 * 1000 });
    } catch (err) {
      await fs.rm(target, { force: true });
      throw new Error(`pg_dump falló: ${err.stderr?.trim() || err.message}`, { cause: err });
    }
    await prune();
    console.log(`[backup] respaldo creado: ${name}`);
    return (await listBackups()).find((b) => b.name === name);
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}

/** Conserva solo los últimos `BACKUP_KEEP` respaldos. */
async function prune() {
  const all = await listBackups();
  for (const old of all.slice(env.backupKeep)) await fs.rm(path.join(env.backupDir, old.name), { force: true });
}

/** Respaldo automático diario: después de las 03:00 (Chile), si aún no hay uno de hoy. */
export function scheduleDailyBackup() {
  const tick = async () => {
    try {
      const { date, hour } = chileStamp();
      if (hour < 3) return;
      const today = (await listBackups()).some((b) => b.name.startsWith(`rsf-${date}-`));
      if (!today) await createBackup('auto');
    } catch (err) {
      console.error('[backup] respaldo automático falló:', err.message);
    }
  };
  setInterval(tick, 30 * 60 * 1000).unref();
  setTimeout(tick, 60 * 1000).unref();
}
