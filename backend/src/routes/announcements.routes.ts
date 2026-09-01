import { Router } from 'express';
import { z } from 'zod';
import { AnnouncementTarget, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { requireAuth, requireStaffRole } from '../middleware/auth';

const router = Router();

const ROLE_TO_TARGET: Record<Role, AnnouncementTarget> = {
  ESTUDIANTE: AnnouncementTarget.ESTUDIANTE,
  DOCENTE: AnnouncementTarget.DOCENTE,
  PADRE: AnnouncementTarget.PADRE,
  ADMIN: AnnouncementTarget.ALL,
};

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const me = req.authUser!;
    const target = ROLE_TO_TARGET[me.role];
    const rows = await prisma.announcement.findMany({
      where: {
        OR: [
          { targetRole: AnnouncementTarget.ALL },
          { targetRole: target },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
      include: { author: { select: { nombre: true, role: true } } },
    });
    res.json({
      exito: true,
      anuncios: rows.map((a) => ({
        id: a.id,
        titulo: a.titulo,
        contenido: a.contenido,
        targetRole: a.targetRole,
        autor: a.author.nombre,
        autorRol: a.author.role,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

const createSchema = z.object({
  titulo: z.string().min(3),
  contenido: z.string().min(3),
  targetRole: z.enum(['ALL', 'ESTUDIANTE', 'DOCENTE', 'PADRE']).default('ALL'),
});

router.post('/', requireAuth, requireStaffRole, async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    const created = await prisma.announcement.create({
      data: {
        authorId: req.authUser!.id,
        titulo: data.titulo,
        contenido: data.contenido,
        targetRole: data.targetRole as AnnouncementTarget,
      },
    });

    // Notificación en bloque para los destinatarios
    const targetRoles =
      data.targetRole === 'ALL'
        ? [Role.ESTUDIANTE, Role.DOCENTE, Role.PADRE]
        : [data.targetRole as Role];
    const users = await prisma.user.findMany({
      where: { role: { in: targetRoles }, isActive: true },
      select: { id: true },
    });
    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          titulo: 'Nuevo anuncio: ' + data.titulo,
          contenido: data.contenido.slice(0, 120),
        })),
      });
    }

    res.json({ exito: true, anuncio: created });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireAuth, requireStaffRole, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const a = await prisma.announcement.findUnique({ where: { id } });
    if (!a) return res.status(404).json({ exito: false, mensaje: 'No existe' });
    if (a.authorId !== req.authUser!.id && req.authUser!.role !== Role.ADMIN) {
      return res.status(403).json({ exito: false, mensaje: 'Solo el autor puede borrarlo.' });
    }
    await prisma.announcement.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) {
    next(err);
  }
});

export { router as announcementsRouter };
