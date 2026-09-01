import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireStaffRole } from '../middleware/auth';

const router = Router();

const createGradeSchema = z.object({
  estudiante_id: z.coerce.number().int().positive(),
  materia: z.string().min(1),
  instancia_evaluacion: z.string().min(1),
  nota: z.coerce.number().int().min(1).max(10),
  fecha: z.string().min(1),
});

router.post('/', requireAuth, requireStaffRole, async (req, res, next) => {
  try {
    const data = createGradeSchema.parse(req.body);

    const student = await prisma.user.findUnique({ where: { id: data.estudiante_id } });
    if (!student || student.role !== Role.ESTUDIANTE) {
      throw HttpError.badRequest('El estudiante seleccionado no existe.');
    }

    await prisma.grade.create({
      data: {
        estudianteId: data.estudiante_id,
        docenteId: req.authUser!.id,
        materia: data.materia,
        instancia: data.instancia_evaluacion,
        nota: data.nota,
        fecha: new Date(data.fecha),
      },
    });

    res.json({ exito: true, mensaje: 'Calificación guardada exitosamente.' });
  } catch (err) {
    next(err);
  }
});

router.get('/mine', requireAuth, requireStaffRole, async (req, res, next) => {
  try {
    const notas = await prisma.grade.findMany({
      where: { docenteId: req.authUser!.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { estudiante: { select: { nombre: true } } },
    });
    res.json({
      exito: true,
      notas: notas.map((n) => ({
        alumno: n.estudiante.nombre,
        materia: n.materia,
        instancia_evaluacion: n.instancia,
        nota: n.nota,
        fecha: n.fecha.toISOString().slice(0, 10),
      })),
    });
  } catch (err) {
    next(err);
  }
});

const listQuerySchema = z.object({
  estudiante_id: z.coerce.number().int().positive(),
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { estudiante_id } = listQuerySchema.parse(req.query);
    const me = req.authUser!;

    if (me.role === Role.ESTUDIANTE && me.id !== estudiante_id) {
      throw HttpError.forbidden('Solo podés ver tus propias calificaciones.');
    }

    if (me.role === Role.PADRE) {
      const link = await prisma.parentStudentLink.findUnique({
        where: { padreId_estudianteId: { padreId: me.id, estudianteId: estudiante_id } },
      });
      if (!link) {
        throw HttpError.forbidden('No tenés a ese alumno vinculado a tu cuenta.');
      }
    }

    const notas = await prisma.grade.findMany({
      where: { estudianteId: estudiante_id },
      orderBy: { fecha: 'desc' },
      include: { docente: { select: { nombre: true } } },
    });

    res.json({
      exito: true,
      notas: notas.map((n) => ({
        materia: n.materia,
        instancia_evaluacion: n.instancia,
        nota: n.nota,
        fecha: n.fecha.toISOString().slice(0, 10),
        nombre_docente: n.docente.nombre,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export { router as gradesRouter };
