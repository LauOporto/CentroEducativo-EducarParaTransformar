import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { esFechaValida, fechaISO, fechaUTC } from '../utils/fechas';
import { registrarAuditoria } from '../services/auditoria.service';

// Parte 1 — sección "Noticias" del sitio público, administrable desde el
// panel Admin (alta, edición y baja). El público solo ve las publicadas.
const publicRouter = Router();
const adminRouter = Router();

type NoticiaRow = Awaited<ReturnType<typeof prisma.noticia.findFirstOrThrow>>;

const aDto = (n: NoticiaRow) => ({ ...n, fecha: fechaISO(n.fecha) });

publicRouter.get('/noticias', async (_req, res, next) => {
  try {
    const noticias = await prisma.noticia.findMany({
      where: { publicada: true },
      orderBy: [{ fecha: 'desc' }, { id: 'desc' }],
      take: 12,
    });
    res.json({ exito: true, noticias: noticias.map(aDto) });
  } catch (err) {
    next(err);
  }
});

const noticiaSchema = z.object({
  titulo: z.string().trim().min(3, 'El título debe tener al menos 3 caracteres.').max(120),
  resumen: z.string().trim().min(10, 'El resumen debe tener al menos 10 caracteres.').max(280),
  contenido: z.string().trim().min(10, 'El contenido debe tener al menos 10 caracteres.').max(5000),
  imagenUrl: z.preprocess(
    (v) => (typeof v === 'string' && v.trim() === '' ? null : v),
    z.string().trim().url('La imagen debe ser una URL válida (https://…).').max(500).nullable().optional(),
  ),
  fecha: z.string().refine(esFechaValida, 'La fecha debe tener el formato AAAA-MM-DD.'),
  publicada: z.boolean().default(true),
});

adminRouter.get('/noticias', async (_req, res, next) => {
  try {
    const noticias = await prisma.noticia.findMany({ orderBy: [{ fecha: 'desc' }, { id: 'desc' }] });
    res.json({ exito: true, noticias: noticias.map(aDto) });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/noticias', async (req, res, next) => {
  try {
    const data = noticiaSchema.parse(req.body);
    const noticia = await prisma.noticia.create({
      data: { ...data, imagenUrl: data.imagenUrl ?? null, fecha: fechaUTC(data.fecha) },
    });
    await registrarAuditoria({
      usuarioId: req.authUser!.id,
      accion: 'ALTA',
      entidad: 'Noticia',
      entidadId: noticia.id,
      detalle: noticia.titulo,
    });
    res.json({ exito: true, noticia: aDto(noticia) });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/noticias/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const actual = await prisma.noticia.findUnique({ where: { id } });
    if (!actual) throw HttpError.notFound('Esa noticia no existe.');
    const data = noticiaSchema.parse(req.body);
    const noticia = await prisma.noticia.update({
      where: { id },
      data: { ...data, imagenUrl: data.imagenUrl ?? null, fecha: fechaUTC(data.fecha) },
    });
    await registrarAuditoria({
      usuarioId: req.authUser!.id,
      accion: 'MODIFICACION',
      entidad: 'Noticia',
      entidadId: id,
      detalle: noticia.titulo,
    });
    res.json({ exito: true, noticia: aDto(noticia) });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/noticias/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const actual = await prisma.noticia.findUnique({ where: { id } });
    if (!actual) throw HttpError.notFound('Esa noticia no existe.');
    await prisma.noticia.delete({ where: { id } });
    await registrarAuditoria({
      usuarioId: req.authUser!.id,
      accion: 'BAJA',
      entidad: 'Noticia',
      entidadId: id,
      detalle: actual.titulo,
    });
    res.json({ exito: true });
  } catch (err) {
    next(err);
  }
});

export { publicRouter as noticiasPublicRouter, adminRouter as noticiasAdminRouter };
