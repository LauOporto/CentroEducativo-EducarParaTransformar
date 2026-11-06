import { createHash, timingSafeEqual } from 'node:crypto';
import { Router, type Request } from 'express';
import { z } from 'zod';

import { env } from '../config/env';
import { HttpError } from '../utils/httpError';
import { esFechaValida } from '../utils/fechas';
import { ejecutarJobsDiarios } from '../services/recordatorios.service';

// D11: disparo de los jobs diarios (HU9). Render free apaga el servicio sin
// tráfico, así que un cron dentro del proceso no es confiable: lo llama el
// workflow .github/workflows/jobs-diarios.yml una vez por día. No usa
// sesión: se protege con el header X-Cron-Secret.
const router = Router();

// Se comparan los hashes para que el tiempo de respuesta no dependa de
// cuántos caracteres de la clave coinciden.
const hash = (valor: string) => createHash('sha256').update(valor).digest();

function verificarClave(req: Request) {
  if (!env.CRON_SECRET) throw new HttpError(503, 'Los jobs automáticos no están configurados (falta CRON_SECRET).');
  const recibida = req.get('x-cron-secret') ?? '';
  if (!timingSafeEqual(hash(recibida), hash(env.CRON_SECRET))) throw HttpError.unauthorized('Clave de cron inválida.');
}

const querySchema = z.object({ fecha: z.string().trim().optional() });

// ?fecha=AAAA-MM-DD simula ese día (para probar sin esperar al día 20).
router.post('/diario', async (req, res, next) => {
  try {
    verificarClave(req);
    const { fecha } = querySchema.parse(req.query);
    if (fecha !== undefined && !esFechaValida(fecha)) {
      throw HttpError.badRequest(`La fecha "${fecha}" es inválida. Usá el formato AAAA-MM-DD.`);
    }
    const resultado = await ejecutarJobsDiarios(fecha);
    res.json({ exito: true, ...resultado });
  } catch (err) {
    next(err);
  }
});

export { router as jobsRouter };
