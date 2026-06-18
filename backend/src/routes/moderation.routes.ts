import { Router } from 'express';
import { z } from 'zod';
import { ModerationStatus, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';
import { upload, publicUrlFor } from '../middleware/upload';

const publicRouter = Router();
const adminRouter = Router();

// ============================================================
// INSCRIPCIONES
// ============================================================
const inscriptionSchema = z.object({
  nombreTutor: z.string().min(2).max(120),
  emailTutor: z.string().email(),
  telefonoTutor: z.string().min(6).max(30),
  nombreEstudiante: z.string().min(2).max(120),
  nivel: z.string().min(2).max(40),
  curso: z.string().min(1).max(60),
  mensaje: z.string().max(2000).optional().nullable(),
});

publicRouter.post('/inscriptions', async (req, res, next) => {
  try {
    const data = inscriptionSchema.parse(req.body);
    const created = await prisma.inscription.create({ data: { ...data, mensaje: data.mensaje ?? null } });
    res.json({
      exito: true,
      mensaje: 'Recibimos tu solicitud de inscripción. Un administrador la revisará y nos pondremos en contacto.',
      id: created.id,
    });
  } catch (err) { next(err); }
});

adminRouter.get('/inscriptions', async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined)?.toUpperCase();
    const where = status && ['PENDIENTE', 'APROBADO', 'RECHAZADO'].includes(status)
      ? { status: status as ModerationStatus }
      : {};
    const items = await prisma.inscription.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ exito: true, inscripciones: items });
  } catch (err) { next(err); }
});

const resolveSchema = z.object({ notaAdmin: z.string().max(500).optional() });

adminRouter.post('/inscriptions/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { notaAdmin } = resolveSchema.parse(req.body ?? {});
    const updated = await prisma.inscription.update({
      where: { id },
      data: { status: ModerationStatus.APROBADO, notaAdmin: notaAdmin ?? null, resolvedAt: new Date() },
    });
    res.json({ exito: true, inscripcion: updated });
  } catch (err) { next(err); }
});

adminRouter.post('/inscriptions/:id/reject', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { notaAdmin } = resolveSchema.parse(req.body ?? {});
    const updated = await prisma.inscription.update({
      where: { id },
      data: { status: ModerationStatus.RECHAZADO, notaAdmin: notaAdmin ?? null, resolvedAt: new Date() },
    });
    res.json({ exito: true, inscripcion: updated });
  } catch (err) { next(err); }
});

adminRouter.delete('/inscriptions/:id', async (req, res, next) => {
  try {
    await prisma.inscription.delete({ where: { id: Number(req.params.id) } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

// ============================================================
// OPINIONES
// ============================================================
const opinionSchema = z.object({
  nombre: z.string().max(80).optional().nullable(),
  rol: z.string().min(1).max(40),
  texto: z.string().min(3).max(2000),
  rating: z.coerce.number().int().min(1).max(5),
});

publicRouter.post('/opinions', async (req, res, next) => {
  try {
    const data = opinionSchema.parse(req.body);
    const created = await prisma.opinion.create({
      data: {
        nombre: data.nombre || null,
        rol: data.rol,
        texto: data.texto,
        rating: data.rating,
      },
    });
    res.json({
      exito: true,
      mensaje: 'Gracias por tu opinión. Será publicada después de la moderación.',
      id: created.id,
    });
  } catch (err) { next(err); }
});

publicRouter.get('/opinions', async (_req, res, next) => {
  try {
    const items = await prisma.opinion.findMany({
      where: { status: ModerationStatus.APROBADO },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { id: true, nombre: true, rol: true, texto: true, rating: true, createdAt: true },
    });
    res.json({ exito: true, opiniones: items });
  } catch (err) { next(err); }
});

adminRouter.get('/opinions', async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined)?.toUpperCase();
    const where = status && ['PENDIENTE', 'APROBADO', 'RECHAZADO'].includes(status)
      ? { status: status as ModerationStatus }
      : {};
    const items = await prisma.opinion.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ exito: true, opiniones: items });
  } catch (err) { next(err); }
});

adminRouter.post('/opinions/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.opinion.update({
      where: { id },
      data: { status: ModerationStatus.APROBADO, resolvedAt: new Date() },
    });
    res.json({ exito: true, opinion: updated });
  } catch (err) { next(err); }
});

adminRouter.post('/opinions/:id/reject', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updated = await prisma.opinion.update({
      where: { id },
      data: { status: ModerationStatus.RECHAZADO, resolvedAt: new Date() },
    });
    res.json({ exito: true, opinion: updated });
  } catch (err) { next(err); }
});

adminRouter.delete('/opinions/:id', async (req, res, next) => {
  try {
    await prisma.opinion.delete({ where: { id: Number(req.params.id) } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

// ============================================================
// EMPLEO (postulaciones con CV opcional en PDF)
// ============================================================
const employmentSchema = z.object({
  nombre: z.string().min(2).max(120),
  email: z.string().email(),
  puesto: z.string().min(2).max(60),
});

publicRouter.post('/employment', upload.single('cv'), async (req, res, next) => {
  try {
    const data = employmentSchema.parse(req.body);
    const cvUrl = req.file ? publicUrlFor(req.file.filename) : null;
    const created = await prisma.employmentApplication.create({
      data: { ...data, cvUrl },
    });
    res.json({
      exito: true,
      mensaje: 'Recibimos tu postulación. La revisaremos y te contactaremos por mail.',
      id: created.id,
    });
  } catch (err) { next(err); }
});

adminRouter.get('/employment', async (req, res, next) => {
  try {
    const status = (req.query.status as string | undefined)?.toUpperCase();
    const where = status && ['PENDIENTE', 'APROBADO', 'RECHAZADO'].includes(status)
      ? { status: status as ModerationStatus }
      : {};
    const items = await prisma.employmentApplication.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ exito: true, postulaciones: items });
  } catch (err) { next(err); }
});

adminRouter.post('/employment/:id/approve', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { notaAdmin } = resolveSchema.parse(req.body ?? {});
    const updated = await prisma.employmentApplication.update({
      where: { id },
      data: { status: ModerationStatus.APROBADO, notaAdmin: notaAdmin ?? null, resolvedAt: new Date() },
    });
    res.json({ exito: true, postulacion: updated });
  } catch (err) { next(err); }
});

adminRouter.post('/employment/:id/reject', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { notaAdmin } = resolveSchema.parse(req.body ?? {});
    const updated = await prisma.employmentApplication.update({
      where: { id },
      data: { status: ModerationStatus.RECHAZADO, notaAdmin: notaAdmin ?? null, resolvedAt: new Date() },
    });
    res.json({ exito: true, postulacion: updated });
  } catch (err) { next(err); }
});

adminRouter.delete('/employment/:id', async (req, res, next) => {
  try {
    await prisma.employmentApplication.delete({ where: { id: Number(req.params.id) } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

// ============================================================
// CONTADORES PARA EL BADGE DEL ADMIN
// ============================================================
adminRouter.get('/moderation/counts', async (_req, res, next) => {
  try {
    const [insc, op, emp, doc] = await Promise.all([
      prisma.inscription.count({ where: { status: ModerationStatus.PENDIENTE } }),
      prisma.opinion.count({ where: { status: ModerationStatus.PENDIENTE } }),
      prisma.employmentApplication.count({ where: { status: ModerationStatus.PENDIENTE } }),
      prisma.user.count({ where: { role: Role.DOCENTE, isActive: false } }),
    ]);
    res.json({
      exito: true,
      pendientes: {
        inscripciones: insc,
        opiniones: op,
        empleo: emp,
        docentes: doc,
        total: insc + op + emp + doc,
      },
    });
  } catch (err) { next(err); }
});

// Admin endpoints requieren ADMIN
adminRouter.use((_req, _res, next) => next()); // placeholder; auth se aplica al montarlo

export { publicRouter as moderationPublicRouter, adminRouter as moderationAdminRouter };

// Helper opcional: middleware para uso desde routes/index.ts
export function requireAdmin() {
  return [requireAuth, requireRole(Role.ADMIN)];
}
