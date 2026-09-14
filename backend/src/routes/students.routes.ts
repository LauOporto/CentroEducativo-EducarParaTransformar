import { Router } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { CURSO_SELECT, formatCursoLabel } from '../utils/cursoLabel';

const router = Router();

router.get('/', requireAuth, requireRole(Role.DOCENTE, Role.ADMIN), async (_req, res, next) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: Role.ESTUDIANTE, isActive: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, dni: true, curso: { select: CURSO_SELECT } },
    });
    res.json({
      exito: true,
      estudiantes: students.map((s) => ({ ...s, curso: formatCursoLabel(s.curso) })),
    });
  } catch (err) {
    next(err);
  }
});

export { router as studentsRouter };
