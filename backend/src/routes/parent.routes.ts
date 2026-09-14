import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';
import { CURSO_SELECT, formatCursoLabel } from '../utils/cursoLabel';
import { dniSchema } from '../utils/validators';

const router = Router();

async function assertHijoVinculado(padreId: number, estudianteId: number) {
  const link = await prisma.parentStudentLink.findUnique({
    where: { padreId_estudianteId: { padreId, estudianteId } },
  });
  if (!link) throw HttpError.forbidden('Ese alumno no está vinculado a tu cuenta.');
}

router.get('/hijos', requireAuth, requireRole(Role.PADRE), async (req, res, next) => {
  try {
    const links = await prisma.parentStudentLink.findMany({
      where: { padreId: req.authUser!.id },
      include: {
        estudiante: { select: { id: true, nombre: true, dni: true, curso: { select: CURSO_SELECT } } },
      },
      orderBy: { id: 'asc' },
    });
    res.json({
      exito: true,
      hijos: links.map((l) => ({ ...l.estudiante, curso: formatCursoLabel(l.estudiante.curso) })),
    });
  } catch (err) {
    next(err);
  }
});

const linkSchema = z.object({ dni: dniSchema });

router.post('/vincular', requireAuth, requireRole(Role.PADRE), async (req, res, next) => {
  try {
    const { dni } = linkSchema.parse(req.body);

    const student = await prisma.user.findUnique({ where: { dni } });
    if (!student || student.role !== Role.ESTUDIANTE) {
      throw HttpError.notFound('No existe ningún estudiante con ese DNI.');
    }

    await prisma.parentStudentLink.upsert({
      where: {
        padreId_estudianteId: { padreId: req.authUser!.id, estudianteId: student.id },
      },
      update: {},
      create: { padreId: req.authUser!.id, estudianteId: student.id },
    });

    const estudianteConCurso = await prisma.user.findUnique({
      where: { id: student.id },
      select: { id: true, nombre: true, dni: true, curso: { select: CURSO_SELECT } },
    });

    res.json({
      exito: true,
      mensaje: 'Hijo vinculado a tu cuenta.',
      hijo: { ...estudianteConCurso, curso: formatCursoLabel(estudianteConCurso?.curso) },
    });
  } catch (err) {
    next(err);
  }
});

// RF-24: el padre inscribe a su hijo al cursado. Solo se permite si el
// hijo todavía no tiene un curso asignado; un cambio de curso posterior
// requiere pasar por Administración (evita que un padre mueva a su hijo
// de curso por su cuenta a mitad de año).
const inscribirCursadoSchema = z.object({ cursoId: z.coerce.number().int().positive() });

router.post('/hijos/:id/inscribir-cursado', requireAuth, requireRole(Role.PADRE), async (req, res, next) => {
  try {
    const estudianteId = Number(req.params.id);
    await assertHijoVinculado(req.authUser!.id, estudianteId);

    const { cursoId } = inscribirCursadoSchema.parse(req.body);
    const curso = await prisma.curso.findUnique({ where: { id: cursoId } });
    if (!curso) throw HttpError.badRequest('El curso indicado no existe.');

    const estudiante = await prisma.user.findUnique({ where: { id: estudianteId } });
    if (!estudiante || estudiante.role !== Role.ESTUDIANTE) throw HttpError.notFound('Alumno no encontrado.');
    if (estudiante.cursoId) {
      throw HttpError.conflict('El alumno ya está inscripto en un curso. Para cambiarlo, contactá a la Dirección.');
    }

    const actualizado = await prisma.user.update({
      where: { id: estudianteId },
      data: { cursoId, estado: 'ACTIVO' },
      select: { id: true, nombre: true, dni: true, curso: { select: CURSO_SELECT } },
    });

    res.json({
      exito: true,
      mensaje: 'Alumno inscripto al cursado.',
      hijo: { ...actualizado, curso: formatCursoLabel(actualizado.curso) },
    });
  } catch (err) {
    next(err);
  }
});

export { router as parentRouter };
