import { Router } from 'express';
import { z } from 'zod';
import { AttendanceStatus, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireStaffRole } from '../middleware/auth';

const router = Router();

const STATUS_VALUES = ['PRESENTE', 'AUSENTE', 'TARDE', 'JUSTIFICADO'] as const;

const recordSchema = z.object({
  estudiante_id: z.coerce.number().int().positive(),
  fecha: z.string().min(8),
  status: z.enum(STATUS_VALUES),
  materia: z.string().optional().nullable(),
  observacion: z.string().optional().nullable(),
});

const bulkSchema = z.object({
  fecha: z.string().min(8),
  materia: z.string().optional().nullable(),
  records: z.array(
    z.object({
      estudiante_id: z.coerce.number().int().positive(),
      status: z.enum(STATUS_VALUES),
      observacion: z.string().optional().nullable(),
    }),
  ),
});

router.post('/', requireAuth, requireStaffRole, async (req, res, next) => {
  try {
    const data = recordSchema.parse(req.body);
    const result = await prisma.attendance.upsert({
      where: {
        estudianteId_fecha_materia: {
          estudianteId: data.estudiante_id,
          fecha: new Date(data.fecha),
          materia: data.materia ?? '',
        },
      },
      update: { status: data.status as AttendanceStatus, observacion: data.observacion ?? null },
      create: {
        estudianteId: data.estudiante_id,
        fecha: new Date(data.fecha),
        status: data.status as AttendanceStatus,
        materia: data.materia ?? '',
        observacion: data.observacion ?? null,
      },
    });
    res.json({ exito: true, asistencia: result });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk', requireAuth, requireStaffRole, async (req, res, next) => {
  try {
    const data = bulkSchema.parse(req.body);
    const fechaDate = new Date(data.fecha);
    const materiaKey = data.materia ?? '';

    const ops = data.records.map((r) =>
      prisma.attendance.upsert({
        where: {
          estudianteId_fecha_materia: {
            estudianteId: r.estudiante_id,
            fecha: fechaDate,
            materia: materiaKey,
          },
        },
        update: { status: r.status as AttendanceStatus, observacion: r.observacion ?? null },
        create: {
          estudianteId: r.estudiante_id,
          fecha: fechaDate,
          materia: materiaKey,
          status: r.status as AttendanceStatus,
          observacion: r.observacion ?? null,
        },
      }),
    );
    await prisma.$transaction(ops);
    res.json({ exito: true, total: data.records.length });
  } catch (err) {
    next(err);
  }
});

const listQuerySchema = z.object({
  estudiante_id: z.coerce.number().int().positive(),
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const { estudiante_id, desde, hasta } = listQuerySchema.parse(req.query);
    const me = req.authUser!;

    if (me.role === Role.ESTUDIANTE && me.id !== estudiante_id) {
      throw HttpError.forbidden('Solo podés ver tus propias asistencias.');
    }
    if (me.role === Role.PADRE) {
      const link = await prisma.parentStudentLink.findUnique({
        where: { padreId_estudianteId: { padreId: me.id, estudianteId: estudiante_id } },
      });
      if (!link) throw HttpError.forbidden('No tenés a ese alumno vinculado.');
    }

    const where: { estudianteId: number; fecha?: { gte?: Date; lte?: Date } } = {
      estudianteId: estudiante_id,
    };
    if (desde || hasta) {
      where.fecha = {};
      if (desde) where.fecha.gte = new Date(desde);
      if (hasta) where.fecha.lte = new Date(hasta);
    }

    const rows = await prisma.attendance.findMany({
      where,
      orderBy: { fecha: 'desc' },
      take: 200,
    });

    res.json({
      exito: true,
      asistencias: rows.map((r) => ({
        id: r.id,
        fecha: r.fecha.toISOString().slice(0, 10),
        status: r.status,
        materia: r.materia || null,
        observacion: r.observacion,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/by-date', requireAuth, requireStaffRole, async (req, res, next) => {
  try {
    const schema = z.object({
      fecha: z.string().min(8),
      materia: z.string().optional().nullable(),
    });
    const { fecha, materia } = schema.parse(req.query);
    const rows = await prisma.attendance.findMany({
      where: {
        fecha: new Date(fecha),
        materia: materia ?? '',
      },
    });
    res.json({
      exito: true,
      asistencias: rows.map((r) => ({
        estudiante_id: r.estudianteId,
        status: r.status,
        observacion: r.observacion,
      })),
    });
  } catch (err) {
    next(err);
  }
});

export { router as attendanceRouter };
