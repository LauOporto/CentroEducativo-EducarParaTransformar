import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const materia = typeof req.query.materia === 'string' ? req.query.materia : undefined;
    const rows = await prisma.studyPlan.findMany({
      where: materia ? { materia } : undefined,
      orderBy: { createdAt: 'desc' },
      include: { docente: { select: { nombre: true } } },
    });
    res.json({
      exito: true,
      planes: rows.map((p) => ({
        id: p.id,
        materia: p.materia,
        titulo: p.titulo,
        objetivos: p.objetivos,
        contenidos: p.contenidos,
        fileUrl: p.fileUrl,
        docente: p.docente.nombre,
        createdAt: p.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  materia: z.string().min(1),
  titulo: z.string().min(2),
  objetivos: z.string().min(2),
  contenidos: z.string().min(2),
});

router.post('/', requireAuth, requireRole(Role.DOCENTE, Role.ADMIN), upload.single('file'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const created = await prisma.studyPlan.create({
      data: {
        docenteId: req.authUser!.id,
        materia: data.materia,
        titulo: data.titulo,
        objetivos: data.objetivos,
        contenidos: data.contenidos,
        fileUrl: req.fileUrl ?? null,
      },
    });
    res.json({ exito: true, plan: created });
  } catch (err) {
    next(err);
  }
});

export { router as studyPlansRouter };
