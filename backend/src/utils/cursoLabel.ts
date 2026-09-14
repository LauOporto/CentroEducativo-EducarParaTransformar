import { PrismaClient } from '@prisma/client';

import { HttpError } from './httpError';

// Los cursos se muestran/seleccionan en el frontend como una etiqueta
// combinada "<Nivel> — <Curso>" (ej: "Secundaria — 1° año"), pero se
// persisten como dos entidades relacionadas (NivelEducativo y Curso).
// Este helper traduce entre ambas representaciones para no romper los
// formularios existentes mientras el modelo se vuelve relacional.
const LABEL_SEPARATOR = '—';

export function formatCursoLabel(curso: { nombre: string; nivel: { nombre: string } } | null | undefined): string | null {
  if (!curso) return null;
  return `${curso.nivel.nombre} ${LABEL_SEPARATOR} ${curso.nombre}`;
}

export async function resolveCursoId(prisma: PrismaClient, label: string | null | undefined): Promise<number | null> {
  if (!label) return null;
  const parts = label.split(LABEL_SEPARATOR).map((p) => p.trim());
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw HttpError.badRequest(`Curso inválido: "${label}".`);
  }
  const [nivelNombre, cursoNombre] = parts;
  const curso = await prisma.curso.findFirst({
    where: { nombre: cursoNombre, nivel: { nombre: nivelNombre } },
    select: { id: true },
  });
  if (!curso) {
    throw HttpError.badRequest(`No existe el curso "${label}". Debe darlo de alta un administrador.`);
  }
  return curso.id;
}

export const CURSO_SELECT = { nombre: true, nivel: { select: { nombre: true } } } as const;
