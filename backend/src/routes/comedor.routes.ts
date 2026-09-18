import { Router } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const turnos = await prisma.turnoComedor.findMany({ orderBy: { nombre: 'asc' } });
    res.json({ exito: true, turnos });
  } catch (err) { next(err); }
});

router.use(requireAuth, requireRole(Role.ADMIN));

// Un único bloque de tiempo, igual criterio que GrupoDeporte.
const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const turnoSchema = z
  .object({
    nombre: z.string().trim().min(2).max(60),
    horaInicio: z.string().trim().regex(horaRegex, 'Formato de hora inválido (HH:mm).'),
    horaFin: z.string().trim().regex(horaRegex, 'Formato de hora inválido (HH:mm).'),
  })
  .refine((data) => data.horaInicio < data.horaFin, {
    message: 'horaInicio debe ser anterior a horaFin.',
    path: ['horaFin'],
  });

// @db.Time: Postgres solo persiste la hora, pero Prisma exige un Date
// completo de entrada, por eso se fija una fecha arbitraria (epoch).
const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

router.post('/', async (req, res, next) => {
  try {
    const data = turnoSchema.parse(req.body);
    const existe = await prisma.turnoComedor.findUnique({ where: { nombre: data.nombre } });
    if (existe) throw HttpError.conflict('Ya existe un turno con ese nombre.');
    const turno = await prisma.turnoComedor.create({
      data: { nombre: data.nombre, horaInicio: toTime(data.horaInicio), horaFin: toTime(data.horaFin) },
    });
    res.json({ exito: true, turno });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = turnoSchema.parse(req.body);
    const conflicto = await prisma.turnoComedor.findFirst({ where: { nombre: data.nombre, NOT: { id } } });
    if (conflicto) throw HttpError.conflict('Ya existe un turno con ese nombre.');
    const turno = await prisma.turnoComedor.update({
      where: { id },
      data: { nombre: data.nombre, horaInicio: toTime(data.horaInicio), horaFin: toTime(data.horaFin) },
    });
    res.json({ exito: true, turno });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const inscripcionesAsociadas = await prisma.inscripcionComedor.count({ where: { turnoId: id } });
    if (inscripcionesAsociadas > 0) {
      throw HttpError.conflict('No se puede eliminar: el turno tiene alumnos inscriptos. Desinscribilos primero.');
    }
    await prisma.turnoComedor.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

export { router as comedorRouter };
