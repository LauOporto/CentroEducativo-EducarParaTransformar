import { Router } from 'express';
import PDFDocument from 'pdfkit';

import { HttpError } from '../utils/httpError';
import { requireAuth } from '../middleware/auth';
import { obtenerEstrategia, listarEstrategias } from '../services/reportes';

const router = Router();

router.use(requireAuth);

// Lista los reportes a los que el usuario logueado tiene acceso, para
// que el frontend arme el menú sin hardcodear claves de reporte.
router.get('/', (req, res) => {
  const disponibles = listarEstrategias()
    .filter((e) => e.rolesAutorizados.includes(req.authUser!.role))
    .map((e) => ({ key: e.key, titulo: e.titulo, descripcion: e.descripcion }));
  res.json({ exito: true, reportes: disponibles });
});

router.get('/:key/pdf', async (req, res, next) => {
  try {
    const estrategia = obtenerEstrategia(req.params.key);
    if (!estrategia) throw HttpError.notFound('Reporte no encontrado.');
    if (!estrategia.rolesAutorizados.includes(req.authUser!.role)) {
      throw HttpError.forbidden('Tu rol no tiene acceso a este reporte.');
    }

    const params = await estrategia.parseParams(req);
    const data = await estrategia.obtenerDatos(params);

    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${estrategia.nombreArchivo(data)}"`);
    doc.pipe(res);
    estrategia.renderPdf(doc, data);
    doc.end();
  } catch (err) { next(err); }
});

export { router as reportesRouter };
