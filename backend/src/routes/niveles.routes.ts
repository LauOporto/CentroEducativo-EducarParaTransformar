import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Lectura: cualquier usuario autenticado (lo consumen los selects de
// curso en varios paneles). El alta pública (RF-4.1) no necesita esto
// porque elige directamente el curso, no el nivel.
router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const niveles = await prisma.nivelEducativo.findMany({ orderBy: { id: 'asc' } });
    res.json({ exito: true, niveles });
  } catch (err) { next(err); }
});

router.use(requireAuth, requireRole(Role.ADMIN));

const nivelSchema = z.object({ nombre: z.string().trim().min(2).max(40) });

router.post('/', async (req, res, next) => {
  try {
    const data = nivelSchema.parse(req.body);
    const existe = await prisma.nivelEducativo.findUnique({ where: { nombre: data.nombre } });
    if (existe) throw HttpError.conflict('Ya existe un nivel educativo con ese nombre.');
    const nivel = await prisma.nivelEducativo.create({ data });
    res.json({ exito: true, nivel });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = nivelSchema.parse(req.body);
    const conflicto = await prisma.nivelEducativo.findFirst({ where: { nombre: data.nombre, NOT: { id } } });
    if (conflicto) throw HttpError.conflict('Ya existe un nivel educativo con ese nombre.');
    const nivel = await prisma.nivelEducativo.update({ where: { id }, data });
    res.json({ exito: true, nivel });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const cursosAsociados = await prisma.curso.count({ where: { nivelId: id } });
    if (cursosAsociados > 0) {
      throw HttpError.conflict('No se puede eliminar: el nivel tiene cursos asociados. Eliminalos o reasignalos primero.');
    }
    await prisma.nivelEducativo.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

export { router as nivelesRouter };
