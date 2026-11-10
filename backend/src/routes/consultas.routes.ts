import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';

import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';
import { telefonoSchema } from '../utils/validators';
import { enviarMail, htmlMail } from '../services/mail.service';
import { registrarAuditoria } from '../services/auditoria.service';

// Parte 1 — "Información de contacto con el centro educativo para realizar
// consultas mediante página web". La consulta queda guardada (el Admin la ve
// y la marca como respondida) y se avisa por mail a la casilla del colegio.
const publicRouter = Router();
const adminRouter = Router();

// 5 consultas cada 15 minutos por IP: frena el spam sin molestar a una familia.
const limiteConsultas = rateLimit({
  windowMs: 1000 * 60 * 15,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: 'TOO_MANY_REQUESTS', message: 'Enviaste varias consultas seguidas. Esperá unos minutos.' },
});

const consultaSchema = z.object({
  nombre: z.string().trim().min(2, 'Ingresá tu nombre.').max(120),
  email: z.string().trim().email('Ingresá un email válido.').max(160),
  telefono: z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), telefonoSchema.optional()),
  asunto: z.string().trim().min(3, 'Ingresá un asunto.').max(120),
  mensaje: z.string().trim().min(10, 'El mensaje debe tener al menos 10 caracteres.').max(2000),
});

async function avisarAlColegio(consulta: z.infer<typeof consultaSchema> & { id: number }) {
  const detalle: [string, string][] = [
    ['Nombre', consulta.nombre],
    ['Email', consulta.email],
    ['Teléfono', consulta.telefono ?? '—'],
    ['Asunto', consulta.asunto],
  ];
  try {
    await enviarMail({
      para: env.CONTACTO_EMAIL,
      asunto: `Nueva consulta web #${consulta.id}: ${consulta.asunto}`,
      texto: `${detalle.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n${consulta.mensaje}`,
      html: htmlMail({
        saludo: 'Llegó una nueva consulta desde el sitio web.',
        parrafos: [
          consulta.mensaje,
          'Respondé directamente al email de la persona y marcala como respondida en el panel.',
        ],
        detalle,
      }),
    });
  } catch (err) {
    // La consulta ya quedó guardada: un fallo del proveedor de mail no la pierde.
    logger.error('No se pudo avisar por mail la consulta web', { id: consulta.id, error: String(err) });
  }
}

publicRouter.post('/consultas', limiteConsultas, async (req, res, next) => {
  try {
    const data = consultaSchema.parse(req.body);
    const consulta = await prisma.consulta.create({ data: { ...data, telefono: data.telefono ?? null } });
    await avisarAlColegio({ ...data, id: consulta.id });
    res.json({ exito: true, mensaje: 'Recibimos tu consulta. Te vamos a responder por email a la brevedad.' });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/consultas', async (req, res, next) => {
  try {
    const estado = String(req.query.estado ?? '').toLowerCase();
    const where =
      estado === 'pendientes' ? { respondida: false } : estado === 'respondidas' ? { respondida: true } : {};
    const consultas = await prisma.consulta.findMany({ where, orderBy: { createdAt: 'desc' } });
    res.json({ exito: true, consultas });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/consultas/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const { respondida } = z.object({ respondida: z.boolean() }).parse(req.body);
    const actual = await prisma.consulta.findUnique({ where: { id } });
    if (!actual) throw HttpError.notFound('Esa consulta no existe.');
    const consulta = await prisma.consulta.update({
      where: { id },
      data: { respondida, respondidaEn: respondida ? new Date() : null },
    });
    await registrarAuditoria({
      usuarioId: req.authUser!.id,
      accion: 'MODIFICACION',
      entidad: 'Consulta',
      entidadId: id,
      detalle: `${respondida ? 'Respondida' : 'Pendiente'} — ${actual.asunto}`,
    });
    res.json({ exito: true, consulta });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/consultas/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const actual = await prisma.consulta.findUnique({ where: { id } });
    if (!actual) throw HttpError.notFound('Esa consulta no existe.');
    await prisma.consulta.delete({ where: { id } });
    await registrarAuditoria({
      usuarioId: req.authUser!.id,
      accion: 'BAJA',
      entidad: 'Consulta',
      entidadId: id,
      detalle: actual.asunto,
    });
    res.json({ exito: true });
  } catch (err) {
    next(err);
  }
});

export { publicRouter as consultasPublicRouter, adminRouter as consultasAdminRouter };
