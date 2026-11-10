import { Router } from 'express';
import { z } from 'zod';
import { DiaSemana, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';
import { assertCanViewStudent } from '../utils/studentAccess';
import { registrarAuditoria } from '../services/auditoria.service';
import { actualizarHorario, crearHorario, listarHorarios } from '../services/horarios.service';

// Parte 2 — "Horarios" (Módulo Administración). El Admin arma el horario de
// cursado de cada curso; el resto de los roles lo consulta según su alcance.
const router = Router();

const listSchema = z.object({
  cursoId: z.coerce.number().int().positive().optional(),
  docenteId: z.coerce.number().int().positive().optional(),
  estudianteId: z.coerce.number().int().positive().optional(),
});

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = listSchema.parse(req.query);
    const me = req.authUser!;
    let filtro: { cursoId?: number; docenteId?: number } = { cursoId: q.cursoId, docenteId: q.docenteId };

    if (me.role === Role.DOCENTE) {
      filtro = { cursoId: q.cursoId, docenteId: me.id };
    } else if (me.role === Role.ESTUDIANTE || me.role === Role.PADRE) {
      // Alumno: su propio curso. Padre: el curso de un hijo vinculado.
      const estudianteId = me.role === Role.ESTUDIANTE ? me.id : q.estudianteId;
      if (!estudianteId) throw HttpError.badRequest('Indicá el alumno (estudianteId).');
      await assertCanViewStudent(req, estudianteId);
      const alumno = await prisma.user.findUnique({ where: { id: estudianteId }, select: { cursoId: true } });
      if (!alumno?.cursoId) {
        res.json({ exito: true, horarios: [] });
        return;
      }
      filtro = { cursoId: alumno.cursoId };
    } else if (q.estudianteId) {
      const alumno = await prisma.user.findUnique({ where: { id: q.estudianteId }, select: { cursoId: true } });
      filtro = { cursoId: alumno?.cursoId ?? -1 };
    }

    res.json({ exito: true, horarios: await listarHorarios(filtro) });
  } catch (err) {
    next(err);
  }
});

router.use(requireAuth, requireRole(Role.ADMIN));

const horaRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

const horarioSchema = z
  .object({
    materiaCursoId: z.coerce.number().int().positive(),
    diaSemana: z.nativeEnum(DiaSemana),
    horaInicio: z.string().trim().regex(horaRegex, 'Formato de hora inválido (HH:mm).'),
    horaFin: z.string().trim().regex(horaRegex, 'Formato de hora inválido (HH:mm).'),
  })
  .refine((d) => d.horaInicio < d.horaFin, {
    message: 'La hora de inicio debe ser anterior a la de fin.',
    path: ['horaFin'],
  });

const detalle = (h: { materia: string; curso: string; diaSemana: string; horaInicio: string; horaFin: string }) =>
  `${h.materia} — ${h.curso} — ${h.diaSemana} ${h.horaInicio}-${h.horaFin}`;

router.post('/', async (req, res, next) => {
  try {
    const horario = await crearHorario(horarioSchema.parse(req.body));
    await registrarAuditoria({
      usuarioId: req.authUser!.id,
      accion: 'ALTA',
      entidad: 'HorarioCurso',
      entidadId: horario.id,
      detalle: detalle(horario),
    });
    res.json({ exito: true, horario });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const horario = await actualizarHorario(id, horarioSchema.parse(req.body));
    await registrarAuditoria({
      usuarioId: req.authUser!.id,
      accion: 'MODIFICACION',
      entidad: 'HorarioCurso',
      entidadId: id,
      detalle: detalle(horario),
    });
    res.json({ exito: true, horario });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const actual = await prisma.horarioCurso.findUnique({ where: { id } });
    if (!actual) throw HttpError.notFound('Ese bloque de horario no existe.');
    await prisma.horarioCurso.delete({ where: { id } });
    await registrarAuditoria({ usuarioId: req.authUser!.id, accion: 'BAJA', entidad: 'HorarioCurso', entidadId: id });
    res.json({ exito: true });
  } catch (err) {
    next(err);
  }
});

export { router as horariosRouter };
