import { Router } from 'express';
import { z } from 'zod';
import { ActivityType, Role, SubmissionStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole, requireStaffRole } from '../middleware/auth';
import { upload, publicUrlFor } from '../middleware/upload';

const router = Router();

const TIPOS = ['ACTIVIDAD', 'TRABAJO', 'PARCIAL', 'TAREA'] as const;

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const me = req.authUser!;
    const materia = typeof req.query.materia === 'string' ? req.query.materia : undefined;
    const where: { materia?: string; docenteId?: number } = {};
    if (materia) where.materia = materia;
    if (me.role === Role.DOCENTE && req.query.mias === '1') where.docenteId = me.id;

    const rows = await prisma.activity.findMany({
      where,
      orderBy: { fechaEntrega: 'asc' },
      include: {
        docente: { select: { nombre: true } },
        submissions: me.role === Role.ESTUDIANTE
          ? { where: { estudianteId: me.id } }
          : true,
      },
    });

    res.json({
      exito: true,
      actividades: rows.map((a) => {
        const propia = me.role === Role.ESTUDIANTE ? a.submissions[0] : null;
        return {
          id: a.id,
          titulo: a.titulo,
          descripcion: a.descripcion,
          materia: a.materia,
          tipo: a.tipo,
          fechaEntrega: a.fechaEntrega.toISOString(),
          maxScore: a.maxScore,
          fileUrl: a.fileUrl,
          docente: a.docente.nombre,
          totalEntregas: a.submissions.length,
          miEntrega: propia ? {
            id: propia.id,
            status: propia.status,
            score: propia.score,
            fileUrl: propia.fileUrl,
            textContent: propia.textContent,
            feedback: propia.feedback,
          } : null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  materia: z.string().min(1),
  titulo: z.string().min(2),
  descripcion: z.string().min(2),
  tipo: z.enum(TIPOS).default('TAREA'),
  fechaEntrega: z.string().min(8),
  maxScore: z.coerce.number().int().positive().default(10),
});

router.post('/', requireAuth, requireStaffRole, upload.single('file'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const created = await prisma.activity.create({
      data: {
        docenteId: req.authUser!.id,
        materia: data.materia,
        titulo: data.titulo,
        descripcion: data.descripcion,
        tipo: data.tipo as ActivityType,
        fechaEntrega: new Date(data.fechaEntrega),
        maxScore: data.maxScore,
        fileUrl: req.file ? publicUrlFor(req.file.filename) : null,
      },
    });
    res.json({ exito: true, actividad: created });
  } catch (err) {
    next(err);
  }
});

const submitSchema = z.object({
  textContent: z.string().optional(),
});

router.post('/:id/submit', requireAuth, requireRole(Role.ESTUDIANTE), upload.single('file'), async (req, res, next) => {
  try {
    const activityId = Number(req.params.id);
    const data = submitSchema.parse(req.body);
    const me = req.authUser!;

    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw HttpError.notFound('Actividad no encontrada.');

    const fileUrl = req.file ? publicUrlFor(req.file.filename) : null;
    if (!fileUrl && !data.textContent) {
      throw HttpError.badRequest('Necesitás adjuntar un archivo o escribir tu entrega.');
    }

    const submission = await prisma.submission.upsert({
      where: { activityId_estudianteId: { activityId, estudianteId: me.id } },
      update: {
        textContent: data.textContent ?? null,
        fileUrl: fileUrl,
        status: SubmissionStatus.ENTREGADO,
        entregadoEn: new Date(),
        score: null,
        feedback: null,
        calificadoEn: null,
      },
      create: {
        activityId,
        estudianteId: me.id,
        textContent: data.textContent ?? null,
        fileUrl: fileUrl,
        status: SubmissionStatus.ENTREGADO,
      },
    });

    await prisma.notification.create({
      data: {
        userId: activity.docenteId,
        titulo: 'Nueva entrega',
        contenido: `Entrega de ${me.usuario} para "${activity.titulo}".`,
      },
    });

    res.json({ exito: true, entrega: submission });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/submissions', requireAuth, requireStaffRole, async (req, res, next) => {
  try {
    const activityId = Number(req.params.id);
    const me = req.authUser!;
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) throw HttpError.notFound('Actividad no encontrada.');
    if (me.role === Role.DOCENTE && activity.docenteId !== me.id) {
      throw HttpError.forbidden('Solo el docente autor puede ver las entregas.');
    }

    const rows = await prisma.submission.findMany({
      where: { activityId },
      orderBy: { entregadoEn: 'desc' },
      include: { estudiante: { select: { id: true, nombre: true, dni: true } } },
    });

    res.json({
      exito: true,
      entregas: rows.map((s) => ({
        id: s.id,
        estudiante: s.estudiante.nombre,
        estudianteId: s.estudiante.id,
        textContent: s.textContent,
        fileUrl: s.fileUrl,
        status: s.status,
        score: s.score,
        feedback: s.feedback,
        entregadoEn: s.entregadoEn.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

const gradeSchema = z.object({
  score: z.coerce.number().int().min(1).max(100),
  feedback: z.string().optional(),
});

router.post('/submissions/:id/grade', requireAuth, requireStaffRole, async (req, res, next) => {
  try {
    const submissionId = Number(req.params.id);
    const data = gradeSchema.parse(req.body);
    const me = req.authUser!;
    const sub = await prisma.submission.findUnique({
      where: { id: submissionId },
      include: { activity: true },
    });
    if (!sub) throw HttpError.notFound('Entrega no encontrada.');
    if (me.role === Role.DOCENTE && sub.activity.docenteId !== me.id) {
      throw HttpError.forbidden('Solo el docente autor puede calificar.');
    }

    const updated = await prisma.submission.update({
      where: { id: submissionId },
      data: {
        score: data.score,
        feedback: data.feedback ?? null,
        status: SubmissionStatus.CALIFICADO,
        calificadoEn: new Date(),
      },
    });

    await prisma.notification.create({
      data: {
        userId: sub.estudianteId,
        titulo: 'Entrega calificada',
        contenido: `Recibiste ${data.score} en "${sub.activity.titulo}".`,
      },
    });

    res.json({ exito: true, entrega: updated });
  } catch (err) {
    next(err);
  }
});

export { router as activitiesRouter };
