import { Router } from 'express';
import { z } from 'zod';

import { HttpError } from '../utils/httpError';
import { hoyArgentina, periodoDeFecha, periodoSiguiente, validarPeriodo } from '../utils/fechas';
import { generarFacturasPeriodo } from '../services/facturacion.service';

// Facturación (D8). Montado en /api/admin/facturacion detrás de
// requireAdmin() (ver routes/index.ts), igual que el resto de las rutas admin.
const router = Router();

const generarSchema = z.object({ periodo: z.string().trim() });

router.post('/generar', async (req, res, next) => {
  try {
    const { periodo } = generarSchema.parse(req.body);
    validarPeriodo(periodo);
    // Hasta el mes siguiente: la emisión automática (HU9) genera el mes
    // próximo el último día hábil; más adelante no tiene sentido facturar.
    const limite = periodoSiguiente(periodoDeFecha(hoyArgentina()));
    if (periodo > limite) {
      throw HttpError.badRequest(`Solo se pueden generar facturas hasta el período ${limite}.`);
    }
    const resultado = await generarFacturasPeriodo(periodo, { usuarioId: req.authUser!.id });
    res.json({ exito: true, ...resultado });
  } catch (err) {
    next(err);
  }
});

export { router as facturacionAdminRouter };
