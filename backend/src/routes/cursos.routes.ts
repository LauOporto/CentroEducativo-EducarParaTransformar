import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

// Público (sin requireAuth): el formulario de registro (RF-4.1) necesita
// poder listar los cursos disponibles antes de que el usuario tenga cuenta.
router.get('/', async (_req, res, next) => {
  try {
    const cursos = await prisma.curso.findMany({
      include: { nivel: true },
      orderBy: [{ nivel: { id: 'asc' } }, { nombre: 'asc' }],
    });
    res.json({
      exito: true,
      cursos: cursos.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        nivelId: c.nivelId,
        nivel: c.nivel.nombre,
        etiqueta: `${c.nivel.nombre} — ${c.nombre}`,
      })),
    });
  } catch (err) { next(err); }
});

router.use(requireAuth, requireRole(Role.ADMIN));

const cursoSchema = z.object({
  nombre: z.string().trim().min(1).max(40),
  nivelId: z.coerce.number().int().positive(),
});

router.post('/', async (req, res, next) => {
  try {
    const data = cursoSchema.parse(req.body);
    const nivel = await prisma.nivelEducativo.findUnique({ where: { id: data.nivelId } });
    if (!nivel) throw HttpError.badRequest('El nivel educativo indicado no existe.');
    const existe = await prisma.curso.findFirst({ where: { nombre: data.nombre, nivelId: data.nivelId } });
    if (existe) throw HttpError.conflict('Ya existe ese curso en ese nivel.');
    const curso = await prisma.curso.create({ data, include: { nivel: true } });
    res.json({ exito: true, curso });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = cursoSchema.partial().parse(req.body);
    if (data.nivelId !== undefined) {
      const nivel = await prisma.nivelEducativo.findUnique({ where: { id: data.nivelId } });
      if (!nivel) throw HttpError.badRequest('El nivel educativo indicado no existe.');
    }
    const curso = await prisma.curso.update({ where: { id }, data, include: { nivel: true } });
    res.json({ exito: true, curso });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const [alumnos, asignaciones] = await Promise.all([
      prisma.user.count({ where: { cursoId: id } }),
      prisma.materiaCurso.count({ where: { cursoId: id } }),
    ]);
    if (alumnos > 0) {
      throw HttpError.conflict(`No se puede eliminar: hay ${alumnos} alumno(s) en este curso. Reasignalos primero.`);
    }
    if (asignaciones > 0) {
      throw HttpError.conflict('No se puede eliminar: el curso tiene materias asignadas. Eliminá esas asignaciones primero.');
    }
    await prisma.curso.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

export { router as cursosRouter };
