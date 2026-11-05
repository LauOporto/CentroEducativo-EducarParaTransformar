import { Router, type RequestHandler } from 'express';
import multer from 'multer';
import { z } from 'zod';

import { requireAuth } from '../middleware/auth';
import { HttpError } from '../utils/httpError';
import { parseRangoFechas } from '../utils/fechas';
import { assertPuedeVerPagos } from '../utils/pagosAccess';
import { prisma } from '../db/prisma';
import { obtenerEstadoCuenta } from '../services/pagos.facade';
import { generarPdfFactura, nombreArchivoFactura } from '../services/facturaPdf.service';
import { almacenamiento, DIR_LOCAL, resolverArchivoLocal } from '../services/almacenamiento';
import {
  anularComprobante,
  cargarTransferencia,
  comprobanteVisible,
  generarComprobante,
  obtenerComprobante,
  urlArchivoComprobante,
} from '../services/comprobantes.service';
import { generarPdfComprobante, nombreArchivoComprobante } from '../services/comprobantePdf.service';

// /api/pagos (RF-49): lo mismo para la app móvil y el web. Permisos de D7:
// ADMIN o PADRE vinculado; DOCENTE y ESTUDIANTE → 403.
const router = Router();

// D6, driver local (solo desarrollo): URL temporal de un comprobante de
// transferencia. No usa requireAuth: el token firmado (5 min) es la
// autorización, igual que la URL firmada de Cloudinary en producción.
// El archivo se sirve con sendFile relativo a DIR_LOCAL (root + dotfiles
// 'deny'): el nombre ya viene validado y send vuelve a impedir salir de esa
// carpeta. El contenido nunca pasa por res.send.
router.get('/archivos/:token', (req, res, next) => {
  try {
    if (almacenamiento.driver() !== 'local') throw HttpError.notFound('El archivo no existe.');
    const { nombre, tipo } = resolverArchivoLocal(req.params.token);
    res.sendFile(
      nombre,
      {
        root: DIR_LOCAL,
        dotfiles: 'deny',
        cacheControl: false,
        lastModified: false,
        etag: false,
        headers: {
          'Content-Type': tipo,
          'Content-Disposition': 'inline',
          'Cache-Control': 'private, no-store',
          'X-Content-Type-Options': 'nosniff',
        },
      },
      (err) => {
        if (err && !res.headersSent) next(HttpError.notFound('El archivo no existe.'));
      },
    );
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

router.get('/comprobantes/:id/pdf', async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'id del comprobante');
    const c = await comprobanteVisible(req.authUser!, id);
    const pdf = await generarPdfComprobante(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivoComprobante(c.numero)}"`);
    res.send(pdf);
  } catch (err) {
    next(err);
  }
});

router.post('/comprobantes/:id/anular', async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'id del comprobante');
    res.json({ exito: true, ...(await anularComprobante(req.authUser!, id)) });
  } catch (err) {
    next(err);
  }
});

// Multer propio de esta ruta (D5 paso 3): en memoria, un solo archivo de
// hasta 5 MB. El tipo real se valida en el servicio por magic bytes.
export const MAX_TRANSFERENCIA_MB = 5;
const parsearTransferencia = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_TRANSFERENCIA_MB * 1024 * 1024, files: 1 },
}).single('archivo');

const recibirTransferencia: RequestHandler = (req, res, next) => {
  parsearTransferencia(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(new HttpError(413, `El archivo supera el máximo de ${MAX_TRANSFERENCIA_MB} MB.`));
      }
      return next(HttpError.badRequest('Adjuntá un único archivo en el campo "archivo".'));
    }
    next(err);
  });
};

router.post('/comprobantes/:id/transferencia', recibirTransferencia, async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'id del comprobante');
    const resultado = await cargarTransferencia(req.authUser!, id, req.body ?? {}, req.file);
    res.json({ exito: true, mensaje: 'Recibimos tu transferencia. La revisará la administración.', ...resultado });
  } catch (err) {
    next(err);
  }
});

router.get('/comprobantes/:id/archivo', async (req, res, next) => {
  try {
    const id = parseId(req.params.id, 'id del comprobante');
    // trust proxy está activo (app.ts): en Render req.protocol es https.
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    res.json({ exito: true, ...(await urlArchivoComprobante(req.authUser!, id, baseUrl)) });
  } catch (err) {
    next(err);
  }
});

export { router as pagosRouter };
