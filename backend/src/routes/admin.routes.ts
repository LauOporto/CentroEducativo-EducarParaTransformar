import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.use(requireAuth, requireRole(Role.ADMIN));

router.get('/stats', async (_req, res, next) => {
  try {
    const [users, byRole, students, teachers, parents, grades, payments, announcements, activities, forumPosts, messages] = await Promise.all([
      prisma.user.count(),
      prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
      prisma.user.count({ where: { role: Role.ESTUDIANTE, isActive: true } }),
      prisma.user.count({ where: { role: Role.DOCENTE, isActive: true } }),
      prisma.user.count({ where: { role: Role.PADRE, isActive: true } }),
      prisma.grade.count(),
      prisma.payment.aggregate({ _sum: { monto: true }, where: { status: 'PAGADO' } }),
      prisma.announcement.count(),
      prisma.activity.count(),
      prisma.forumPost.count(),
      prisma.message.count(),
    ]);
    res.json({
      exito: true,
      stats: {
        totalUsuarios: users,
        estudiantesActivos: students,
        docentesActivos: teachers,
        padresActivos: parents,
        notasRegistradas: grades,
        totalRecaudado: Number(payments._sum.monto || 0),
        anuncios: announcements,
        actividades: activities,
        temasForo: forumPosts,
        mensajesIntercambiados: messages,
        porRol: byRole.map((r) => ({ role: r.role, count: r._count._all })),
      },
    });
  } catch (err) { next(err); }
});

const userListSchema = z.object({
  role: z.enum(['ESTUDIANTE', 'DOCENTE', 'PADRE', 'ADMIN']).optional(),
  q: z.string().optional(),
});

router.get('/users', async (req, res, next) => {
  try {
    const { role, q } = userListSchema.parse(req.query);
    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: role as Role } : {}),
        ...(q ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { usuario: { contains: q, mode: 'insensitive' } },
            { dni: { contains: q } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: [{ role: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true, usuario: true, email: true, dni: true, nombre: true,
        role: true, curso: true, isActive: true, createdAt: true,
      },
    });
    res.json({ exito: true, usuarios: users });
  } catch (err) { next(err); }
});

const createUserSchema = z.object({
  usuario: z.string().min(3).max(40),
  email: z.string().email(),
  dni: z.string().min(6).max(15),
  nombre: z.string().min(2),
  role: z.enum(['ESTUDIANTE', 'DOCENTE', 'PADRE', 'ADMIN']),
  curso: z.string().optional().nullable(),
  password: z.string().min(6),
});

router.post('/users', async (req, res, next) => {
  try {
    const data = createUserSchema.parse(req.body);
    const exists = await prisma.user.findFirst({
      where: { OR: [{ usuario: data.usuario }, { email: data.email }, { dni: data.dni }] },
      select: { id: true },
    });
    if (exists) throw HttpError.conflict('Usuario, email o DNI ya existen.');
    const hash = await bcrypt.hash(data.password, 10);
    const user = await prisma.user.create({
      data: {
        usuario: data.usuario,
        email: data.email,
        dni: data.dni,
        nombre: data.nombre,
        role: data.role as Role,
        curso: data.role === 'ESTUDIANTE' ? (data.curso ?? null) : null,
        password: hash,
      },
      select: { id: true, usuario: true, nombre: true, role: true, dni: true, email: true, curso: true, isActive: true },
    });
    res.json({ exito: true, usuario: user });
  } catch (err) { next(err); }
});

const updateUserSchema = z.object({
  nombre: z.string().min(2).optional(),
  email: z.string().email().optional(),
  usuario: z.string().min(3).max(40).optional(),
  dni: z.string().min(6).max(15).optional(),
  role: z.enum(['ESTUDIANTE', 'DOCENTE', 'PADRE', 'ADMIN']).optional(),
  curso: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});

router.patch('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = updateUserSchema.parse(req.body);

    // Verificar colisiones en campos únicos
    if (data.usuario || data.email || data.dni) {
      const conflicting = await prisma.user.findFirst({
        where: {
          NOT: { id },
          OR: [
            ...(data.usuario ? [{ usuario: data.usuario }] : []),
            ...(data.email ? [{ email: data.email }] : []),
            ...(data.dni ? [{ dni: data.dni }] : []),
          ],
        },
        select: { id: true, usuario: true, email: true, dni: true },
      });
      if (conflicting) {
        if (conflicting.usuario === data.usuario) throw HttpError.conflict('Ese nombre de usuario ya está tomado.');
        if (conflicting.email === data.email) throw HttpError.conflict('Ese email ya está registrado.');
        if (conflicting.dni === data.dni) throw HttpError.conflict('Ese DNI ya está registrado.');
        throw HttpError.conflict('Conflicto con otro usuario.');
      }
    }

    const patch: Record<string, unknown> = {};
    if (data.nombre !== undefined) patch.nombre = data.nombre;
    if (data.email !== undefined) patch.email = data.email;
    if (data.usuario !== undefined) patch.usuario = data.usuario;
    if (data.dni !== undefined) patch.dni = data.dni;
    if (data.role !== undefined) patch.role = data.role as Role;
    if (data.curso !== undefined) patch.curso = data.curso;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    if (data.password !== undefined) patch.password = await bcrypt.hash(data.password, 10);

    // Si dejó de ser estudiante, limpiar curso
    if (data.role && data.role !== 'ESTUDIANTE' && patch.curso === undefined) {
      patch.curso = null;
    }

    const user = await prisma.user.update({
      where: { id },
      data: patch,
      select: { id: true, usuario: true, nombre: true, role: true, dni: true, email: true, curso: true, isActive: true },
    });
    res.json({ exito: true, usuario: user });
  } catch (err) { next(err); }
});

router.delete('/users/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (id === req.authUser!.id) throw HttpError.badRequest('No podés borrar tu propia cuenta.');
    await prisma.user.update({ where: { id }, data: { isActive: false } });
    res.json({ exito: true, mensaje: 'Usuario desactivado.' });
  } catch (err) { next(err); }
});

const linkSchema = z.object({
  padreId: z.coerce.number().int().positive(),
  estudianteId: z.coerce.number().int().positive(),
});

router.get('/links', async (_req, res, next) => {
  try {
    const links = await prisma.parentStudentLink.findMany({
      include: {
        padre: { select: { id: true, nombre: true, dni: true } },
        estudiante: { select: { id: true, nombre: true, dni: true, curso: true } },
      },
      orderBy: { id: 'desc' },
    });
    res.json({ exito: true, links });
  } catch (err) { next(err); }
});

router.post('/links', async (req, res, next) => {
  try {
    const data = linkSchema.parse(req.body);
    const padre = await prisma.user.findUnique({ where: { id: data.padreId } });
    const est = await prisma.user.findUnique({ where: { id: data.estudianteId } });
    if (!padre || padre.role !== Role.PADRE) throw HttpError.badRequest('El padre no es válido.');
    if (!est || est.role !== Role.ESTUDIANTE) throw HttpError.badRequest('El estudiante no es válido.');
    const link = await prisma.parentStudentLink.upsert({
      where: { padreId_estudianteId: { padreId: data.padreId, estudianteId: data.estudianteId } },
      update: {},
      create: { padreId: data.padreId, estudianteId: data.estudianteId },
    });
    res.json({ exito: true, link });
  } catch (err) { next(err); }
});

router.delete('/links/:id', async (req, res, next) => {
  try {
    await prisma.parentStudentLink.delete({ where: { id: Number(req.params.id) } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

const createPaymentSchema = z.object({
  estudianteId: z.coerce.number().int().positive(),
  concepto: z.string().min(2),
  monto: z.coerce.number().positive(),
  vencimiento: z.string().min(8),
});

router.post('/payments', async (req, res, next) => {
  try {
    const data = createPaymentSchema.parse(req.body);
    const link = await prisma.parentStudentLink.findFirst({
      where: { estudianteId: data.estudianteId },
      select: { padreId: true },
    });
    const payment = await prisma.payment.create({
      data: {
        estudianteId: data.estudianteId,
        padreId: link?.padreId ?? null,
        concepto: data.concepto,
        monto: data.monto,
        vencimiento: new Date(data.vencimiento),
      },
    });
    res.json({ exito: true, payment });
  } catch (err) { next(err); }
});

// Docentes pendientes de aprobación
router.get('/teachers/pending', async (_req, res, next) => {
  try {
    const pendientes = await prisma.user.findMany({
      where: { role: Role.DOCENTE, isActive: false },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true, usuario: true, email: true, dni: true, nombre: true,
        createdAt: true,
      },
    });
    res.json({ exito: true, docentes: pendientes });
  } catch (err) { next(err); }
});

router.post('/teachers/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw HttpError.notFound('Docente no encontrado.');
    if (user.role !== Role.DOCENTE) throw HttpError.badRequest('El usuario no es docente.');
    if (user.isActive) throw HttpError.badRequest('El docente ya fue aprobado.');
    const aprobado = await prisma.user.update({
      where: { id },
      data: { isActive: true },
      select: { id: true, usuario: true, nombre: true, email: true, dni: true, isActive: true },
    });
    await prisma.notification.create({
      data: {
        userId: id,
        titulo: 'Cuenta aprobada',
        contenido: 'Un administrador aprobó tu cuenta de docente. Ya podés iniciar sesión.',
      },
    });
    res.json({ exito: true, docente: aprobado });
  } catch (err) { next(err); }
});

router.delete('/teachers/:id/reject', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw HttpError.notFound('Docente no encontrado.');
    if (user.role !== Role.DOCENTE) throw HttpError.badRequest('El usuario no es docente.');
    if (user.isActive) throw HttpError.badRequest('No se puede rechazar un docente ya aprobado.');
    await prisma.user.delete({ where: { id } });
    res.json({ exito: true, mensaje: 'Solicitud de docente rechazada.' });
  } catch (err) { next(err); }
});

export { router as adminRouter };
