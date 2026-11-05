import { Router } from 'express';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth';
import { HttpError } from '../utils/httpError';
import { parseRangoFechas } from '../utils/fechas';
import { assertPuedeVerPagos } from '../utils/pagosAccess';
import { prisma } from '../db/prisma';
import { obtenerEstadoCuenta } from '../services/pagos.facade';
import { generarPdfFactura, nombreArchivoFactura } from '../services/facturaPdf.service';
import { almacenamiento, leerArchivoLocal } from '../services/almacenamiento';
import { generarComprobante, obtenerComprobante } from '../services/comprobantes.service';

// /api/pagos (RF-49): lo mismo para la app móvil y el web. Permisos de D7:
// ADMIN o PADRE vinculado; DOCENTE y ESTUDIANTE → 403.
const router = Router();

// D6, driver local (solo desarrollo): URL temporal de un comprobante de
// transferencia. No usa requireAuth: el token firmado (5 min) es la
// autorización, igual que la URL firmada de Cloudinary en producción.
router.get('/archivos/:token', async (req, res, next) => {
  try {
    if (almacenamiento.driver() !== 'local') throw HttpError.notFound('El archivo no existe.');
    const { buffer, tipo } = await leerArchivoLocal(req.params.token);
    res.setHeader('Content-Type', tipo);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

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

// ---- RF-50: comprobantes de pago (D5) ----

router.post('/comprobantes', async (req, res, next) => {
  try {
    const resultado = await generarComprobante(req.authUser!, req.body);
    res.status(201).json({ exito: true, ...resultado });
  } catch (err) {
    next(err);
  }
});

router.get('/comprobantes/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'id del comprobante');
    res.json({ exito: true, ...(await obtenerComprobante(req.authUser!, id)) });
  } catch (err) {
    next(err);
  }
});

export { router as pagosRouter };
