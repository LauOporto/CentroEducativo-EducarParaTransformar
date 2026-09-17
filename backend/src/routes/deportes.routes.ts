import { Router } from 'express';
import { z } from 'zod';
import { DiaSemana, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';

const router = Router();

router.get('/', requireAuth, async (_req, res, next) => {
  try {
    const deportes = await prisma.deporte.findMany({ orderBy: { nombre: 'asc' } });
    res.json({ exito: true, deportes });
  } catch (err) { next(err); }
});

// Grupos de deporte (RF-14): deporte + nivel + día + horario + profesor
// responsable. Lectura abierta a cualquier logueado, con filtros opcionales
// por query (un DOCENTE puede querer ver sus propios grupos).
const listGruposSchema = z.object({
  deporteId: z.coerce.number().int().positive().optional(),
  nivelId: z.coerce.number().int().positive().optional(),
  docenteId: z.coerce.number().int().positive().optional(),
});

router.get('/grupos', requireAuth, async (req, res, next) => {
  try {
    const query = listGruposSchema.parse(req.query);

    const grupos = await prisma.grupoDeporte.findMany({
      where: {
        ...(query.deporteId ? { deporteId: query.deporteId } : {}),
        ...(query.nivelId ? { nivelId: query.nivelId } : {}),
        ...(query.docenteId ? { docenteId: query.docenteId } : {}),
      },
      include: {
        deporte: true,
        nivel: true,
        docente: { select: { id: true, nombre: true } },
      },
      orderBy: [{ deporte: { nombre: 'asc' } }, { nivel: { id: 'asc' } }, { diaSemana: 'asc' }],
    });

    res.json({
      exito: true,
      grupos: grupos.map((g) => ({
        id: g.id,
        deporteId: g.deporteId,
        deporte: g.deporte.nombre,
        nivelId: g.nivelId,
        nivel: g.nivel.nombre,
        diaSemana: g.diaSemana,
        horaInicio: g.horaInicio.toISOString().slice(11, 16),
        horaFin: g.horaFin.toISOString().slice(11, 16),
        docenteId: g.docenteId,
        docente: g.docente.nombre,
      })),
    });
  } catch (err) { next(err); }
});

router.use(requireAuth, requireRole(Role.ADMIN));

const deporteSchema = z.object({ nombre: z.string().trim().min(2).max(40) });

router.post('/', async (req, res, next) => {
  try {
    const data = deporteSchema.parse(req.body);
    const existe = await prisma.deporte.findUnique({ where: { nombre: data.nombre } });
    if (existe) throw HttpError.conflict('Ya existe un deporte con ese nombre.');
    const deporte = await prisma.deporte.create({ data });
    res.json({ exito: true, deporte });
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const data = deporteSchema.parse(req.body);
    const conflicto = await prisma.deporte.findFirst({ where: { nombre: data.nombre, NOT: { id } } });
    if (conflicto) throw HttpError.conflict('Ya existe un deporte con ese nombre.');
    const deporte = await prisma.deporte.update({ where: { id }, data });
    res.json({ exito: true, deporte });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const gruposAsociados = await prisma.grupoDeporte.count({ where: { deporteId: id } });
    if (gruposAsociados > 0) {
      throw HttpError.conflict('No se puede eliminar: el deporte tiene grupos asociados. Eliminalos primero.');
    }
    await prisma.deporte.delete({ where: { id } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

// HH:mm de 24hs. Se compara como string (zero-padded) para validar
// horaInicio < horaFin sin necesidad de parsear fechas.
const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const grupoSchema = z
  .object({
    deporteId: z.coerce.number().int().positive(),
    nivelId: z.coerce.number().int().positive(),
    diaSemana: z.nativeEnum(DiaSemana),
    horaInicio: z.string().trim().regex(horaRegex, 'Formato de hora inválido (HH:mm).'),
    horaFin: z.string().trim().regex(horaRegex, 'Formato de hora inválido (HH:mm).'),
    docenteId: z.coerce.number().int().positive(),
  })
  .refine((data) => data.horaInicio < data.horaFin, {
    message: 'horaInicio debe ser anterior a horaFin.',
    path: ['horaFin'],
  });

// GrupoDeporte.horaInicio/horaFin son @db.Time: Postgres solo persiste la
// hora, pero Prisma exige un Date completo de entrada, por eso se fija una
// fecha arbitraria (epoch) igual para todos los registros (ver seed.ts).
const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

router.post('/grupos', async (req, res, next) => {
  try {
    const data = grupoSchema.parse(req.body);

    const [deporte, nivel, docente] = await Promise.all([
      prisma.deporte.findUnique({ where: { id: data.deporteId } }),
      prisma.nivelEducativo.findUnique({ where: { id: data.nivelId } }),
      prisma.user.findUnique({ where: { id: data.docenteId } }),
    ]);
    if (!deporte) throw HttpError.badRequest('El deporte indicado no existe.');
    if (!nivel) throw HttpError.badRequest('El nivel educativo indicado no existe.');
    if (!docente || docente.role !== Role.DOCENTE) throw HttpError.badRequest('El profesor indicado no es válido.');

    const horaInicio = toTime(data.horaInicio);
    const horaFin = toTime(data.horaFin);

    const existe = await prisma.grupoDeporte.findUnique({
      where: {
        deporteId_nivelId_diaSemana_horaInicio_horaFin: {
          deporteId: data.deporteId,
          nivelId: data.nivelId,
          diaSemana: data.diaSemana,
          horaInicio,
          horaFin,
        },
      },
    });
    if (existe) throw HttpError.conflict('Ya existe un grupo con ese deporte, nivel, día y horario.');

    const grupo = await prisma.grupoDeporte.create({
      data: {
        deporteId: data.deporteId,
        nivelId: data.nivelId,
        diaSemana: data.diaSemana,
        horaInicio,
        horaFin,
        docenteId: data.docenteId,
      },
      include: {
        deporte: true,
        nivel: true,
        docente: { select: { id: true, nombre: true } },
      },
    });
    res.json({ exito: true, grupo });
  } catch (err) { next(err); }
});

router.delete('/grupos/:id', async (req, res, next) => {
  try {
    await prisma.grupoDeporte.delete({ where: { id: Number(req.params.id) } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

export { router as deportesRouter };
