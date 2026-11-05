import { Router } from 'express';
import { z } from 'zod';

import { HttpError } from '../utils/httpError';
import { aprobarComprobante, listarComprobantesAdmin, rechazarComprobante } from '../services/comprobantes.service';

// Revisión de comprobantes de pago (RF-50, D5 pasos 5 y 6). Montado en
// /api/admin/pagos detrás de requireAdmin() (ver routes/index.ts), igual
// que facturacion.routes.
const router = Router();

const idSchema = z.coerce.number().int().positive();

function parseId(valor: string): number {
  const r = idSchema.safeParse(valor);
  if (!r.success) throw HttpError.badRequest('El id del comprobante es inválido.');
  return r.data;
}

router.get('/comprobantes', async (req, res, next) => {
  try {
    res.json({ exito: true, ...(await listarComprobantesAdmin(req.query)) });
  } catch (err) {
    next(err);
  }
});

router.post('/comprobantes/:id/aprobar', async (req, res, next) => {
  try {
    const resultado = await aprobarComprobante(req.authUser!, parseId(req.params.id), req.body);
    res.json({ exito: true, mensaje: 'Pago acreditado.', ...resultado });
  } catch (err) {
    next(err);
  }
});

router.post('/comprobantes/:id/rechazar', async (req, res, next) => {
  try {
    const resultado = await rechazarComprobante(req.authUser!, parseId(req.params.id), req.body);
    res.json({ exito: true, mensaje: 'Comprobante rechazado.', ...resultado });
  } catch (err) {
    next(err);
  }
});

export { router as pagosAdminRouter };
