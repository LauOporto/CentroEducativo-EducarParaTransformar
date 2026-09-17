import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const turnos = await prisma.turnoComedor.findMany({ orderBy: { nombre: 'asc' } });
    res.json({ exito: true, turnos });
  } catch (err) { next(err); }
});

router.use(requireAuth, requireRole(Role.ADMIN));

// `horario` es texto libre descriptivo (ver decisión 4.b del plan): no hay
// ninguna regla de negocio de solapamiento horario sobre este catálogo.
const turnoSchema = z.object({
  nombre: z.string().trim().min(2).max(60),
  horario: z.string().trim().min(3).max(80),
});

router.post('/', async (req, res, next) => {
  try {
    const data = turnoSchema.parse(req.body);
    const existe = await prisma.turnoComedor.findUnique({ where: { nombre: data.nombre } });
    if (existe) throw HttpError.conflict('Ya existe un turno con ese nombre.');
    const turno = await prisma.turnoComedor.create({ data });
    res.json({ exito: true, turno });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = turnoSchema.partial().parse(req.body);
    if (data.nombre !== undefined) {
      const conflicto = await prisma.turnoComedor.findFirst({ where: { nombre: data.nombre, NOT: { id } } });
      if (conflicto) throw HttpError.conflict('Ya existe un turno con ese nombre.');
    }
    const turno = await prisma.turnoComedor.update({ where: { id }, data });
    res.json({ exito: true, turno });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await prisma.turnoComedor.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

export { router as comedorRouter };
