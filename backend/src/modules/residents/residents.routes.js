import { Router } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { hasAdminAccess, verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { z } from 'zod';
import { AppError } from '../../utils/AppError.js';
import { parse, parseId } from '../../utils/validation.js';
import {
  conditionSchema,
  createResidentSchema,
  listQuerySchema,
  medicationSchema,
  statusSchema,
  updateResidentSchema,
} from './residents.validators.js';
import * as residents from './residents.service.js';

export const residentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxPhotoBytes, files: 1 },
});

const adminOnly = verifyRole([ROLES.ADMIN]);
const isAdmin = (req) => hasAdminAccess(req.user);

// Todas las rutas requieren sesión; lectura para ambos roles, escritura solo ADMIN
residentsRouter.use(verifyToken, verifyRole([ROLES.ADMIN, ROLES.CUIDADORA]));

residentsRouter.get('/', async (req, res) => {
  const filters = parse(listQuerySchema, req.query);
  res.json(await residents.listResidents(filters, { isAdmin: isAdmin(req) }));
});

residentsRouter.get('/:id', async (req, res) => {
  const id = parseId(req.params);
  res.json({ data: await residents.getResident(id, { isAdmin: isAdmin(req) }) });
});

residentsRouter.post('/', adminOnly, async (req, res) => {
  const input = parse(createResidentSchema, req.body);
  res.status(201).json({ data: await residents.createResident(input, req.user.id) });
});

residentsRouter.put('/:id', adminOnly, async (req, res) => {
  const id = parseId(req.params);
  const input = parse(updateResidentSchema, req.body);
  res.json({ data: await residents.updateResident(id, input, req.user.id) });
});

residentsRouter.patch('/:id/status', adminOnly, async (req, res) => {
  const id = parseId(req.params);
  const { is_active } = parse(statusSchema, req.body);
  res.json({ data: await residents.setResidentStatus(id, is_active, req.user.id) });
});

// --- Foto del residente ---
residentsRouter.get('/:id/photo', async (req, res) => {
  const id = parseId(req.params);
  const filePath = await residents.getPhotoPath(id, { isAdmin: isAdmin(req) });
  res.sendFile(filePath, { headers: { 'Cache-Control': 'private, max-age=86400' } });
});

residentsRouter.post('/:id/photo', adminOnly, upload.single('photo'), async (req, res) => {
  const id = parseId(req.params);
  res.json({ data: await residents.savePhoto(id, req.file, req.user.id) });
});

residentsRouter.delete('/:id/photo', adminOnly, async (req, res) => {
  const id = parseId(req.params);
  res.json({ data: await residents.deletePhoto(id, req.user.id) });
});

// --- Patologías y medicamentos (lectura en GET /:id; escritura ADMIN) ---
const subParams = z.object({ id: z.string().uuid(), itemId: z.string().uuid() });
function parseSub(params) {
  const result = subParams.safeParse(params);
  if (!result.success) throw AppError.notFound();
  return result.data;
}

residentsRouter.post('/:id/conditions', adminOnly, async (req, res) => {
  const id = parseId(req.params);
  res.status(201).json({ data: await residents.addCondition(id, parse(conditionSchema, req.body), req.user.id) });
});

residentsRouter.delete('/:id/conditions/:itemId', adminOnly, async (req, res) => {
  const { id, itemId } = parseSub(req.params);
  res.json({ data: await residents.deleteCondition(id, itemId) });
});

residentsRouter.post('/:id/medications', adminOnly, async (req, res) => {
  const id = parseId(req.params);
  res.status(201).json({ data: await residents.addMedication(id, parse(medicationSchema, req.body), req.user.id) });
});

residentsRouter.put('/:id/medications/:itemId', adminOnly, async (req, res) => {
  const { id, itemId } = parseSub(req.params);
  res.json({ data: await residents.updateMedication(id, itemId, parse(medicationSchema, req.body), req.user.id) });
});

residentsRouter.delete('/:id/medications/:itemId', adminOnly, async (req, res) => {
  const { id, itemId } = parseSub(req.params);
  res.json({ data: await residents.deleteMedication(id, itemId) });
});
