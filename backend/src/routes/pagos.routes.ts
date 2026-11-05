import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth';
import { HttpError } from '../utils/httpError';
import { parseRangoFechas } from '../utils/fechas';
import { assertPuedeVerPagos } from '../utils/pagosAccess';
import { prisma } from '../db/prisma';
import { obtenerEstadoCuenta } from '../services/pagos.facade';
import { generarPdfFactura, nombreArchivoFactura } from '../services/facturaPdf.service';

// /api/pagos (RF-49): lo mismo para la app móvil y el web. Permisos de D7:
// ADMIN o PADRE vinculado; DOCENTE y ESTUDIANTE → 403.
const router = Router();

router.use(requireAuth);

const idSchema = z.coerce.number().int().positive();

function parseId(valor: string, nombre: string): number {
  const r = idSchema.safeParse(valor);
  if (!r.success) throw HttpError.badRequest(`El ${nombre} es inválido.`);
  return r.data;
}

const rangoQuerySchema = z.object({
  desde: z.string().optional(),
  hasta: z.string().optional(),
});

router.get('/hijos/:estudianteId/estado-cuenta', async (req, res, next) => {
  try {
    const estudianteId = parseId(req.params.estudianteId, 'id del alumno');
    const alumno = await assertPuedeVerPagos(req, estudianteId);
    const { desde, hasta } = rangoQuerySchema.parse(req.query);
    const rango = parseRangoFechas(desde, hasta);
    const estado = await obtenerEstadoCuenta(estudianteId, rango, { alumno });
    res.json({ exito: true, ...estado });
  } catch (err) {
    next(err);
  }
});

router.get('/facturas/:id/pdf', async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'id de la factura');
    const factura = await prisma.factura.findUnique({ where: { id }, select: { estudianteId: true, numero: true } });
    if (!factura) throw HttpError.notFound('La factura indicada no existe.');
    await assertPuedeVerPagos(req, factura.estudianteId);
    const pdf = await generarPdfFactura(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivoFactura(factura.numero)}"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

export { router as pagosRouter };
