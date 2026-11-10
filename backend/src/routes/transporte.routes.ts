import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { hayNombreEquivalente } from '../utils/texto';
import { requireAuth, requireRole } from '../middleware/auth';
import { actualizarPrecio, conMonto } from '../services/precios.service';

const router = Router();

export const MAX_RECORRIDOS = 4;

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const recorridos = await prisma.recorridoTransporte.findMany({ orderBy: { nombre: 'asc' } });
    res.json({ exito: true, recorridos: recorridos.map((x) => conMonto(x, 'precioMensual')) });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth, requireRole(Role.ADMIN));

// Parte 3: valor mensual propio de cada recorrido. Solo ADMIN (el router ya lo exige).
// Rige para las facturas que se emitan después; las emitidas no cambian.
router.put('/:id/precio', async (req, res, next) => {
  try {
    const recorrido = await actualizarPrecio('recorrido', Number(req.params.id), req.body?.precio, req.authUser!.id);
    res.json({ exito: true, recorrido });
  } catch (err) {
    next(err);
  }
});

// Salida y regreso son dos eventos distintos del día (no un rango continuo
// como GrupoDeporte), por eso los campos se llaman horaSalida/horaRegreso.
const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const recorridoSchema = z
  .object({
    nombre: z.string().trim().min(2).max(60),
    horaSalida: z.string().trim().regex(horaRegex, 'Formato de hora inválido (HH:mm).'),
    horaRegreso: z.string().trim().regex(horaRegex, 'Formato de hora inválido (HH:mm).'),
  })
  .refine((data) => data.horaSalida < data.horaRegreso, {
    message: 'horaSalida debe ser anterior a horaRegreso.',
    path: ['horaRegreso'],
  });

// @db.Time: Postgres solo persiste la hora, pero Prisma exige un Date
// completo de entrada, por eso se fija una fecha arbitraria (epoch).
const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

router.post('/', async (req, res, next) => {
  try {
    const data = recorridoSchema.parse(req.body);
    // Regla de negocio del TP: "El servicio de transporte tiene cuatro recorridos".
    if ((await prisma.recorridoTransporte.count()) >= MAX_RECORRIDOS) {
      throw HttpError.conflict(
        `El servicio de transporte admite como máximo ${MAX_RECORRIDOS} recorridos. Editá uno existente en lugar de crear otro.`,
      );
    }
    const existe = hayNombreEquivalente(
      await prisma.recorridoTransporte.findMany({ select: { id: true, nombre: true } }),
      data.nombre,
    );
    if (existe) throw HttpError.conflict('Ya existe un recorrido con ese nombre.');
    const recorrido = await prisma.recorridoTransporte.create({
      data: { nombre: data.nombre, horaSalida: toTime(data.horaSalida), horaRegreso: toTime(data.horaRegreso) },
    });
    res.json({ exito: true, recorrido: conMonto(recorrido, 'precioMensual') });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = recorridoSchema.parse(req.body);
    const conflicto = hayNombreEquivalente(
      await prisma.recorridoTransporte.findMany({ select: { id: true, nombre: true } }),
      data.nombre,
      id,
    );
    if (conflicto) throw HttpError.conflict('Ya existe un recorrido con ese nombre.');
    const recorrido = await prisma.recorridoTransporte.update({
      where: { id },
      data: { nombre: data.nombre, horaSalida: toTime(data.horaSalida), horaRegreso: toTime(data.horaRegreso) },
    });
    res.json({ exito: true, recorrido: conMonto(recorrido, 'precioMensual') });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const inscripcionesAsociadas = await prisma.inscripcionTransporte.count({ where: { recorridoId: id } });
    if (inscripcionesAsociadas > 0) {
      throw HttpError.conflict('No se puede eliminar: el recorrido tiene alumnos inscriptos. Desinscribilos primero.');
    }
    await prisma.recorridoTransporte.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) {
    next(err);
  }
});

export { router as transporteRouter };
