import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { upload } from '../middleware/upload';
import { registrarAuditoria } from '../services/auditoria.service';

// RF-7: galería administrable desde el panel Admin (antes eran URLs de
// Unsplash hardcodeadas en el frontend).
const publicRouter = Router();
const adminRouter = Router();

publicRouter.get('/galeria', async (_req, res, next) => {
  try {
    const imagenes = await prisma.galeriaImagen.findMany({ orderBy: [{ orden: 'asc' }, { createdAt: 'asc' }] });
    res.json({ exito: true, imagenes });
  } catch (err) { next(err); }
});

const crearSchema = z.object({
  alt: z.string().trim().min(2).max(120),
  orden: z.coerce.number().int().min(0).optional(),
});

adminRouter.post('/galeria', upload.single('imagen'), async (req, res, next) => {
  try {
    if (!req.fileUrl) throw HttpError.badRequest('Falta el archivo de imagen.');
    const data = crearSchema.parse(req.body);
    const imagen = await prisma.galeriaImagen.create({
      data: { url: req.fileUrl, alt: data.alt, orden: data.orden ?? 0 },
    });
    await registrarAuditoria({
      usuarioId: req.authUser!.id, accion: 'ALTA', entidad: 'GaleriaImagen', entidadId: imagen.id, detalle: imagen.alt,
    });
    res.json({ exito: true, imagen });
  } catch (err) { next(err); }
});

adminRouter.delete('/galeria/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    // ponytail: no se borra el archivo en Cloudinary, solo la fila. Para un
    // proyecto de cátedra no justifica guardar el public_id y llamar a la
    // API de borrado; si el storage gratuito se llena, agregarlo acá.
    await prisma.galeriaImagen.delete({ where: { id } });
    await registrarAuditoria({ usuarioId: req.authUser!.id, accion: 'BAJA', entidad: 'GaleriaImagen', entidadId: id });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

export { publicRouter as galeriaPublicRouter, adminRouter as galeriaAdminRouter };
