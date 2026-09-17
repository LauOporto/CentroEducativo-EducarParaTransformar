import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const recorridos = await prisma.recorridoTransporte.findMany({ orderBy: { nombre: 'asc' } });
    res.json({ exito: true, recorridos });
  } catch (err) { next(err); }
});

router.use(requireAuth, requireRole(Role.ADMIN));

// `horario` es texto libre descriptivo (ver decisión 4.b del plan): no hay
// ninguna regla de negocio de solapamiento horario sobre este catálogo.
const recorridoSchema = z.object({
  nombre: z.string().trim().min(2).max(60),
  horario: z.string().trim().min(3).max(80),
});

router.post('/', async (req, res, next) => {
  try {
    const data = recorridoSchema.parse(req.body);
    const existe = await prisma.recorridoTransporte.findUnique({ where: { nombre: data.nombre } });
    if (existe) throw HttpError.conflict('Ya existe un recorrido con ese nombre.');
    const recorrido = await prisma.recorridoTransporte.create({ data });
    res.json({ exito: true, recorrido });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = recorridoSchema.partial().parse(req.body);
    if (data.nombre !== undefined) {
      const conflicto = await prisma.recorridoTransporte.findFirst({ where: { nombre: data.nombre, NOT: { id } } });
      if (conflicto) throw HttpError.conflict('Ya existe un recorrido con ese nombre.');
    }
    const recorrido = await prisma.recorridoTransporte.update({ where: { id }, data });
    res.json({ exito: true, recorrido });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.recorridoTransporte.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

export { router as transporteRouter };
