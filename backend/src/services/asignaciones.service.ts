import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';

// Alta de una asignación Profesor–Materia–Curso (RF-13). Compartido por
// POST /materias/asignaciones y POST /profesores/:id/materias para que las
// reglas (existencia, rol DOCENTE, terna duplicada → 409) vivan en un solo
// lugar.
export async function crearAsignacion(data: { materiaId: number; cursoId: number; docenteId: number }) {
  const [materia, curso, docente] = await Promise.all([
    prisma.materia.findUnique({ where: { id: data.materiaId } }),
    prisma.curso.findUnique({ where: { id: data.cursoId } }),
    prisma.user.findUnique({ where: { id: data.docenteId } }),
  ]);
  if (!materia) throw HttpError.badRequest('La materia indicada no existe.');
  if (!curso) throw HttpError.badRequest('El curso indicado no existe.');
  if (!docente || docente.role !== Role.DOCENTE) throw HttpError.badRequest('El profesor indicado no es válido.');

  const existe = await prisma.materiaCurso.findUnique({
    where: { materiaId_cursoId_docenteId: data },
  });
  if (existe) throw HttpError.conflict('Esa asignación materia-curso-profesor ya existe.');

  return prisma.materiaCurso.create({
    data,
    include: { materia: true, curso: { include: { nivel: true } }, docente: { select: { id: true, nombre: true } } },
  });
}
