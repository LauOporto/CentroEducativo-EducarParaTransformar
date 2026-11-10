import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';
import { crearAsignacion, actualizarAsignacion } from '../services/asignaciones.service';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const materias = await prisma.materia.findMany({ orderBy: { nombre: 'asc' } });
    res.json({ exito: true, materias });
  } catch (err) {
    next(err);
  }
});

// Asignaciones Profesor–Materia–Curso (RF-13). Un DOCENTE solo puede ver
// las suyas; ADMIN puede filtrar por cualquier combinación.
const listAsignacionesSchema = z.object({
  materiaId: z.coerce.number().int().positive().optional(),
  cursoId: z.coerce.number().int().positive().optional(),
  docenteId: z.coerce.number().int().positive().optional(),
});

router.get('/asignaciones', requireAuth, requireRole(Role.ADMIN, Role.DOCENTE), async (req, res, next) => {
  try {
    const query = listAsignacionesSchema.parse(req.query);
    const docenteId = req.authUser!.role === Role.DOCENTE ? req.authUser!.id : query.docenteId;

    const asignaciones = await prisma.materiaCurso.findMany({
      where: {
        ...(query.materiaId ? { materiaId: query.materiaId } : {}),
        ...(query.cursoId ? { cursoId: query.cursoId } : {}),
        ...(docenteId ? { docenteId } : {}),
      },
      include: {
        materia: true,
        curso: { include: { nivel: true } },
        docente: { select: { id: true, nombre: true } },
      },
      orderBy: [{ curso: { nivel: { id: 'asc' } } }, { curso: { nombre: 'asc' } }, { materia: { nombre: 'asc' } }],
    });

    res.json({
      exito: true,
      asignaciones: asignaciones.map((a) => ({
        id: a.id,
        materiaId: a.materiaId,
        materia: a.materia.nombre,
        cursoId: a.cursoId,
        curso: `${a.curso.nivel.nombre} — ${a.curso.nombre}`,
        docenteId: a.docenteId,
        docente: a.docente.nombre,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth, requireRole(Role.ADMIN));

const materiaSchema = z.object({ nombre: z.string().trim().min(2).max(60) });

router.post('/', async (req, res, next) => {
  try {
    const data = materiaSchema.parse(req.body);
    const existe = await prisma.materia.findFirst({
      where: { nombre: { equals: data.nombre, mode: 'insensitive' as const } },
    });
    if (existe) throw HttpError.conflict('Ya existe una materia con ese nombre.');
    const materia = await prisma.materia.create({ data });
    res.json({ exito: true, materia });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = materiaSchema.parse(req.body);
    const conflicto = await prisma.materia.findFirst({
      where: { nombre: { equals: data.nombre, mode: 'insensitive' as const }, NOT: { id } },
    });
    if (conflicto) throw HttpError.conflict('Ya existe una materia con ese nombre.');
    const anterior = await prisma.materia.findUnique({ where: { id } });
    if (!anterior) throw HttpError.notFound('Esa materia no existe.');
    // Notas, asistencias y planes guardan la materia por nombre: al renombrarla
    // se actualizan en la misma transacción para que no queden registros huérfanos.
    const [materia] = await prisma.$transaction([
      prisma.materia.update({ where: { id }, data }),
      prisma.grade.updateMany({ where: { materia: anterior.nombre }, data: { materia: data.nombre } }),
      prisma.attendance.updateMany({ where: { materia: anterior.nombre }, data: { materia: data.nombre } }),
      prisma.studyPlan.updateMany({ where: { materia: anterior.nombre }, data: { materia: data.nombre } }),
    ]);
    res.json({ exito: true, materia });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const asignaciones = await prisma.materiaCurso.count({ where: { materiaId: id } });
    if (asignaciones > 0) {
      throw HttpError.conflict(
        'No se puede eliminar: la materia tiene asignaciones a curso/profesor. Eliminalas primero.',
      );
    }
    const materia = await prisma.materia.findUnique({ where: { id } });
    if (!materia) throw HttpError.notFound('Esa materia no existe.');
    const [notas, asistencias, planes] = await Promise.all([
      prisma.grade.count({ where: { materia: materia.nombre } }),
      prisma.attendance.count({ where: { materia: materia.nombre } }),
      prisma.studyPlan.count({ where: { materia: materia.nombre } }),
    ]);
    if (notas + asistencias + planes > 0) {
      throw HttpError.conflict(
        `No se puede eliminar: la materia tiene historial (${notas} notas, ${asistencias} asistencias, ${planes} planes de estudio).`,
      );
    }
    await prisma.materia.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) {
    next(err);
  }
});

const asignacionSchema = z.object({
  materiaId: z.coerce.number().int().positive(),
  cursoId: z.coerce.number().int().positive(),
  docenteId: z.coerce.number().int().positive(),
});

router.post('/asignaciones', async (req, res, next) => {
  try {
    const data = asignacionSchema.parse(req.body);
    const asignacion = await crearAsignacion(data);
    res.json({ exito: true, asignacion });
  } catch (err) {
    next(err);
  }
});

router.patch('/asignaciones/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = asignacionSchema.parse(req.body);
    const asignacion = await actualizarAsignacion(id, data);
    res.json({ exito: true, asignacion });
  } catch (err) {
    next(err);
  }
});

router.delete('/asignaciones/:id', async (req, res, next) => {
  try {
    await prisma.materiaCurso.delete({ where: { id: Number(req.params.id) } });
    res.json({ exito: true });
  } catch (err) {
    next(err);
  }
});

export { router as materiasRouter };
