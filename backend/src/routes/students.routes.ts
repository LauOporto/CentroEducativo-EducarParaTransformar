import { Router } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { requireAuth, requireStaffRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, requireStaffRole, async (_req, res, next) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: Role.ESTUDIANTE, isActive: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, dni: true, curso: true },
    });
    res.json({ exito: true, estudiantes: students });
  } catch (err) {
    next(err);
  }
});

export { router as studentsRouter };
