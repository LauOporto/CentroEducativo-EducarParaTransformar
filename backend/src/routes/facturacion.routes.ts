import { Router } from 'express';
import { z } from 'zod';

import { HttpError } from '../utils/httpError';
import { hoyArgentina, periodoDeFecha, periodoSiguiente, validarPeriodo } from '../utils/fechas';
import { generarFacturasPeriodo } from '../services/facturacion.service';
import { enviarAvisoDeuda, enviarEmision } from '../services/recordatorios.service';

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

// HU9: disparo manual de los mails automáticos, para la demo (sin esperar al
// último día hábil o al día 20). No repite envíos ya hechos: usa el mismo
// registro que el job diario.
const jobSchema = z.object({ periodo: z.string().trim().optional() });

router.post('/jobs/:tipo', async (req, res, next) => {
  try {
    const { periodo } = jobSchema.parse(req.body ?? {});
    const actual = periodoDeFecha(hoyArgentina());
    if (req.params.tipo === 'emision') {
      // Por defecto, lo mismo que haría el último día hábil: el mes siguiente.
      const p = validarPeriodo(periodo ?? periodoSiguiente(actual));
      if (p > periodoSiguiente(actual)) {
        throw HttpError.badRequest(`Solo se pueden emitir facturas hasta el período ${periodoSiguiente(actual)}.`);
      }
      // La generación manual queda en la auditoría a nombre del admin.
      res.json({ exito: true, ...(await enviarEmision(p, { usuarioId: req.authUser!.id })) });
      return;
    }
    if (req.params.tipo === 'deuda') {
      res.json({ exito: true, ...(await enviarAvisoDeuda(validarPeriodo(periodo ?? actual))) });
      return;
    }
    throw HttpError.notFound('El job indicado no existe. Usá "emision" o "deuda".');
  } catch (err) {
    next(err);
  }
});

export { router as facturacionAdminRouter };
