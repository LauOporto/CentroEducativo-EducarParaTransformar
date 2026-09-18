import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const recorridos = await prisma.recorridoTransporte.findMany({ orderBy: { nombre: 'asc' } });
    res.json({ exito: true, recorridos });
  } catch (err) { next(err); }
});

router.use(requireAuth, requireRole(Role.ADMIN));

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
    const existe = await prisma.recorridoTransporte.findUnique({ where: { nombre: data.nombre } });
    if (existe) throw HttpError.conflict('Ya existe un recorrido con ese nombre.');
    const recorrido = await prisma.recorridoTransporte.create({
      data: { nombre: data.nombre, horaSalida: toTime(data.horaSalida), horaRegreso: toTime(data.horaRegreso) },
    });
    res.json({ exito: true, recorrido });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = recorridoSchema.parse(req.body);
    const conflicto = await prisma.recorridoTransporte.findFirst({ where: { nombre: data.nombre, NOT: { id } } });
    if (conflicto) throw HttpError.conflict('Ya existe un recorrido con ese nombre.');
    const recorrido = await prisma.recorridoTransporte.update({
      where: { id },
      data: { nombre: data.nombre, horaSalida: toTime(data.horaSalida), horaRegreso: toTime(data.horaRegreso) },
    });
    res.json({ exito: true, recorrido });
  } catch (err) { next(err); }
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
  } catch (err) { next(err); }
});

export { router as transporteRouter };
