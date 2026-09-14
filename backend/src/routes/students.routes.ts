import { Router, type Request } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';
import { CURSO_SELECT, formatCursoLabel } from '../utils/cursoLabel';
import { telefonoSchema } from '../utils/validators';

const router = Router();

const FICHA_SELECT = {
  id: true,
  usuario: true,
  email: true,
  dni: true,
  nombre: true,
  apellido: true,
  legajo: true,
  fechaNacimiento: true,
  domicilio: true,
  telefono: true,
  estado: true,
  isActive: true,
  curso: { select: CURSO_SELECT },
} as const;

function serializeFicha<T extends { curso: Parameters<typeof formatCursoLabel>[0] }>(u: T) {
  return { ...u, curso: formatCursoLabel(u.curso) };
}

// Un alumno puede ver su propia ficha; un padre solo la de sus hijos
// vinculados; docente/admin sin restricción (RNF-44/RNF-47).
async function assertCanAccessStudent(req: Request, studentId: number) {
  const { role, id } = req.authUser!;
  if (role === Role.ADMIN || role === Role.DOCENTE) return;
  if (role === Role.ESTUDIANTE) {
    if (id !== studentId) throw HttpError.forbidden('Solo podés consultar tu propia ficha.');
    return;
  }
  if (role === Role.PADRE) {
    const link = await prisma.parentStudentLink.findUnique({
      where: { padreId_estudianteId: { padreId: id, estudianteId: studentId } },
    });
    if (!link) throw HttpError.forbidden('Ese alumno no está vinculado a tu cuenta.');
    return;
  }
  throw HttpError.forbidden();
}

router.get('/', requireAuth, requireRole(Role.DOCENTE, Role.ADMIN), async (_req, res, next) => {
  try {
    const students = await prisma.user.findMany({
      where: { role: Role.ESTUDIANTE, isActive: true },
      orderBy: { nombre: 'asc' },
      select: { id: true, nombre: true, dni: true, legajo: true, curso: { select: CURSO_SELECT } },
    });
    res.json({
      exito: true,
      estudiantes: students.map((s) => serializeFicha(s)),
    });
  } catch (err) { next(err); }
});

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await assertCanAccessStudent(req, id);

    const student = await prisma.user.findUnique({ where: { id }, select: FICHA_SELECT });
    if (!student) throw HttpError.notFound('Alumno no encontrado.');

    res.json({ exito: true, alumno: serializeFicha(student) });
  } catch (err) { next(err); }
});

router.get('/:id/materias', requireAuth, async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await assertCanAccessStudent(req, id);

    const student = await prisma.user.findUnique({ where: { id }, select: { role: true, cursoId: true } });
    if (!student || student.role !== Role.ESTUDIANTE) throw HttpError.notFound('Alumno no encontrado.');

    if (!student.cursoId) {
      res.json({ exito: true, materias: [], mensaje: 'El alumno todavía no tiene un curso asignado.' });
      return;
    }

    const asignaciones = await prisma.materiaCurso.findMany({
      where: { cursoId: student.cursoId },
      include: { materia: true, docente: { select: { id: true, nombre: true } } },
      orderBy: { materia: { nombre: 'asc' } },
    });

    res.json({
      exito: true,
      materias: asignaciones.map((a) => ({
        materiaId: a.materiaId,
        materia: a.materia.nombre,
        docenteId: a.docenteId,
        docente: a.docente.nombre,
      })),
    });
  } catch (err) { next(err); }
});

// Auto-edición limitada: el propio alumno solo puede actualizar sus
// datos de contacto, nunca legajo, curso, estado ni DNI (RNF-44).
const misDatosSchema = z.object({
  email: z.string().email().optional(),
  telefono: telefonoSchema.optional(),
  domicilio: z.string().trim().min(3).max(200).optional(),
});

router.patch('/me', requireAuth, requireRole(Role.ESTUDIANTE), async (req, res, next) => {
  try {
    const data = misDatosSchema.parse(req.body);
    if (data.email) {
      const conflicto = await prisma.user.findFirst({ where: { email: data.email, NOT: { id: req.authUser!.id } } });
      if (conflicto) throw HttpError.conflict('Ese email ya está en uso.');
    }
    const student = await prisma.user.update({
      where: { id: req.authUser!.id },
      data,
      select: FICHA_SELECT,
    });
    res.json({ exito: true, alumno: serializeFicha(student) });
  } catch (err) { next(err); }
});

export { router as studentsRouter };
