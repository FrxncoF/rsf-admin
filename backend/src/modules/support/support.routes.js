import { Router } from 'express';
import { z } from 'zod';
import { verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse } from '../../utils/validation.js';
import { CATALOGS, getSetting, setSetting } from '../settings/settings.service.js';
import * as support from './support.service.js';
import { createBackup, listBackups } from './backups.service.js';
import { AppError } from '../../utils/AppError.js';

export const supportRouter = Router();

// Sección técnica: exclusiva del rol SOPORTE
supportRouter.use(verifyToken, verifyRole([ROLES.SOPORTE]));

const pageQuery = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
};

supportRouter.get('/status', async (_req, res) => {
  res.json({ data: await support.getStatus() });
});

supportRouter.get('/errors', async (req, res) => {
  res.json(await support.listErrors(parse(z.object(pageQuery), req.query)));
});

supportRouter.get('/logins', async (req, res) => {
  const schema = z.object({
    ...pageQuery,
    search: z.string().trim().max(100).optional(),
    onlyFailed: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
  });
  res.json(await support.listLogins(parse(schema, req.query)));
});

supportRouter.get('/backups', async (_req, res) => {
  res.json({ data: await listBackups() });
});

supportRouter.post('/backups', async (_req, res) => {
  res.status(201).json({ data: await createBackup('manual') });
});

// --- Configuración ---
const bannerSchema = z
  .object({
    enabled: z.boolean(),
    message: z.string().trim().max(300, 'Máximo 300 caracteres').default(''),
    tone: z.enum(['info', 'warning', 'danger', 'success']).default('info'),
    dismissible: z.boolean().default(true),
  })
  .refine((b) => !b.enabled || b.message, { message: 'Escribe el mensaje', path: ['message'] });

const catalogSchema = z
  .array(
    z.object({
      value: z
        .string()
        .trim()
        .regex(/^[A-Z0-9_]{2,30}$/, 'Código inválido'),
      label: z.string().trim().min(1, 'Ingresa el nombre').max(60),
      active: z.boolean().default(true),
      standalone: z.boolean().optional(),
    }),
  )
  .min(1, 'Debe quedar al menos una opción')
  .max(60)
  .refine((items) => new Set(items.map((i) => i.value)).size === items.length, 'Hay códigos repetidos');

supportRouter.get('/settings', async (_req, res) => {
  const [banner, ...catalogs] = await Promise.all([getSetting('banner'), ...CATALOGS.map(getSetting)]);
  res.json({ data: { banner, ...Object.fromEntries(CATALOGS.map((k, i) => [k, catalogs[i]])) } });
});

supportRouter.put('/settings/banner', async (req, res) => {
  res.json({ data: await setSetting('banner', parse(bannerSchema, req.body), req.user.id) });
});

supportRouter.put('/settings/:catalog', async (req, res) => {
  const { catalog } = req.params;
  if (!CATALOGS.includes(catalog)) throw AppError.notFound();
  const items = parse(catalogSchema, req.body);
  // No se pueden quitar códigos existentes (los residentes los usan): solo desactivarlos
  const current = await getSetting(catalog);
  const missing = current.filter((c) => !items.some((i) => i.value === c.value));
  if (missing.length) throw AppError.badRequest(`No se puede quitar "${missing[0].label}": desactívalo en su lugar`);
  res.json({ data: await setSetting(catalog, items, req.user.id) });
});
