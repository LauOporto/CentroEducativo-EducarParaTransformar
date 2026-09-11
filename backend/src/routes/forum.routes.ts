import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';
import { notify } from './notifications.routes';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const materia = typeof req.query.materia === 'string' ? req.query.materia : undefined;
    const rows = await prisma.forumPost.findMany({
      where: materia ? { materia } : undefined,
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
      include: {
        author: { select: { nombre: true, role: true } },
        _count: { select: { replies: true } },
      },
    });
    res.json({
      exito: true,
      posts: rows.map((p) => ({
        id: p.id,
        materia: p.materia,
        titulo: p.titulo,
        contenido: p.contenido,
        isPinned: p.isPinned,
        createdAt: p.createdAt.toISOString(),
        autor: p.author.nombre,
        autorRol: p.author.role,
        replies: p._count.replies,
      })),
    });
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const post = await prisma.forumPost.findUnique({
      where: { id },
      include: {
        author: { select: { nombre: true, role: true } },
        replies: {
          orderBy: { createdAt: 'asc' },
          include: { author: { select: { nombre: true, role: true } } },
        },
      },
    });
    if (!post) throw HttpError.notFound('Tema no encontrado.');
    res.json({
      exito: true,
      post: {
        id: post.id,
        materia: post.materia,
        titulo: post.titulo,
        contenido: post.contenido,
        isPinned: post.isPinned,
        createdAt: post.createdAt.toISOString(),
        autor: post.author.nombre,
        autorRol: post.author.role,
      },
      respuestas: post.replies.map((r) => ({
        id: r.id,
        contenido: r.contenido,
        autor: r.author.nombre,
        autorRol: r.author.role,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  } catch (err) { next(err); }
});

const createPostSchema = z.object({
  materia: z.string().min(1),
  titulo: z.string().min(2),
  contenido: z.string().min(2),
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const data = createPostSchema.parse(req.body);
    const post = await prisma.forumPost.create({
      data: {
        authorId: req.authUser!.id,
        materia: data.materia,
        titulo: data.titulo,
        contenido: data.contenido,
      },
    });
    res.json({ exito: true, post });
  } catch (err) { next(err); }
});

const replySchema = z.object({ contenido: z.string().min(1).max(5000) });

router.post('/:id/reply', requireAuth, async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    const { contenido } = replySchema.parse(req.body);
    const post = await prisma.forumPost.findUnique({ where: { id: postId } });
    if (!post) throw HttpError.notFound('Tema no encontrado.');

    const reply = await prisma.forumReply.create({
      data: { postId, authorId: req.authUser!.id, contenido },
    });

    if (post.authorId !== req.authUser!.id) {
      await notify({
        userId: post.authorId,
        titulo: 'Nueva respuesta en tu tema',
        contenido: `"${post.titulo}" tiene una nueva respuesta.`,
      });
    }

    res.json({ exito: true, respuesta: reply });
  } catch (err) { next(err); }
});

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post) throw HttpError.notFound('Tema no encontrado.');
    if (post.authorId !== req.authUser!.id && req.authUser!.role !== Role.ADMIN) {
      throw HttpError.forbidden('Solo el autor o un admin puede borrar.');
    }
    await prisma.forumPost.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

router.post('/:id/pin', requireAuth, requireRole(Role.DOCENTE, Role.ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const post = await prisma.forumPost.findUnique({ where: { id } });
    if (!post) throw HttpError.notFound('Tema no encontrado.');
    const updated = await prisma.forumPost.update({
      where: { id },
      data: { isPinned: !post.isPinned },
    });
    res.json({ exito: true, isPinned: updated.isPinned });
  } catch (err) { next(err); }
});

export { router as forumRouter };
