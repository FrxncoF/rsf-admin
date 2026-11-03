import { Router } from 'express';
import multer from 'multer';
import { env } from '../../config/env.js';
import { verifyRole, verifyToken, ROLES } from '../../middlewares/auth.js';
import { parse, parseId } from '../../utils/validation.js';
import { createResidentSchema, listQuerySchema, statusSchema, updateResidentSchema } from './residents.validators.js';
import * as residents from './residents.service.js';

export const residentsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxPhotoBytes, files: 1 },
});

const adminOnly = verifyRole([ROLES.ADMIN]);
const isAdmin = (req) => req.user.role === ROLES.ADMIN;

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

residentsRouter.delete('/:id', adminOnly, async (req, res) => {
  const id = parseId(req.params);
  await residents.deleteResident(id);
  res.status(204).end();
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
