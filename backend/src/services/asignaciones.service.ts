import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';

type Terna = { materiaId: number; cursoId: number; docenteId: number };

async function validarTerna(data: Terna) {
  const [materia, curso, docente] = await Promise.all([
    prisma.materia.findUnique({ where: { id: data.materiaId } }),
    prisma.curso.findUnique({ where: { id: data.cursoId } }),
    prisma.user.findUnique({ where: { id: data.docenteId } }),
  ]);
  if (!materia) throw HttpError.badRequest('La materia indicada no existe.');
  if (!curso) throw HttpError.badRequest('El curso indicado no existe.');
  if (!docente || docente.role !== Role.DOCENTE) throw HttpError.badRequest('El profesor indicado no es válido.');
}

const ASIGNACION_INCLUDE = {
  materia: true,
  curso: { include: { nivel: true } },
  docente: { select: { id: true, nombre: true } },
} as const;

// Alta de una asignación Profesor–Materia–Curso (RF-13). Compartido por
// POST /materias/asignaciones y POST /profesores/:id/materias para que las
// reglas (existencia, rol DOCENTE, terna duplicada → 409) vivan en un solo
// lugar.
export async function crearAsignacion(data: Terna) {
  await validarTerna(data);

  const existe = await prisma.materiaCurso.findUnique({
    where: { materiaId_cursoId_docenteId: data },
  });
  if (existe) throw HttpError.conflict('Esa asignación materia-curso-profesor ya existe.');

  return prisma.materiaCurso.create({ data, include: ASIGNACION_INCLUDE });
}

// Edición de una asignación existente (Académico → Materia → Curso →
// Profesor). Mismas reglas que el alta, pero el chequeo de duplicado
// excluye la propia fila (si no, nunca se podría "guardar sin cambios").
export async function actualizarAsignacion(id: number, data: Terna) {
  const actual = await prisma.materiaCurso.findUnique({ where: { id } });
  if (!actual) throw HttpError.notFound('Esa asignación no existe.');

  await validarTerna(data);

  const duplicada = await prisma.materiaCurso.findFirst({ where: { ...data, NOT: { id } } });
  if (duplicada) throw HttpError.conflict('Ya existe esa asignación materia-curso-profesor.');

  return prisma.materiaCurso.update({ where: { id }, data, include: ASIGNACION_INCLUDE });
}
