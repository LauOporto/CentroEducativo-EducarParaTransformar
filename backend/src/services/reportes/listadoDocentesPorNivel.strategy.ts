import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import type { ReportStrategy } from './types';
import { encabezadoReporte, tabla } from './pdfHelpers';

// TP — "Listado de docentes por nivel educativo" (RF-29): Nivel
// educativo, Profesor, Materias a cargo, Cursos. Se agrupa por
// (docente, nivel): un profesor que dicta en dos niveles aparece una
// fila por nivel, con sus materias/cursos de ESE nivel agregados.

interface Params {
  nivelId: number | null;
}

interface Fila {
  nivel: string;
  profesor: string;
  materias: string;
  cursos: string;
}

interface Datos {
  nivelFiltro: string | null;
  filas: Fila[];
}

function parseParams(req: Request): Params {
  if (req.query.nivelId === undefined || req.query.nivelId === '') return { nivelId: null };
  const nivelId = Number(req.query.nivelId);
  if (!Number.isInteger(nivelId) || nivelId <= 0) throw HttpError.badRequest('El parámetro nivelId es inválido.');
  return { nivelId };
}

async function obtenerDatos({ nivelId }: Params): Promise<Datos> {
  const nivelFiltroRow = nivelId ? await prisma.nivelEducativo.findUnique({ where: { id: nivelId } }) : null;
  if (nivelId && !nivelFiltroRow) throw HttpError.notFound('El nivel indicado no existe.');

  const asignaciones = await prisma.materiaCurso.findMany({
    where: nivelId ? { curso: { nivelId } } : {},
    include: {
      materia: true,
      docente: { select: { id: true, nombre: true } },
      curso: { include: { nivel: true } },
    },
    orderBy: [{ curso: { nivel: { id: 'asc' } } }, { docente: { nombre: 'asc' } }],
  });

  // Agrupar por (docenteId, nivelId): materias y cursos como sets para
  // no repetir si el docente dicta la misma materia en varios cursos.
  const grupos = new Map<string, { nivel: string; profesor: string; materias: Set<string>; cursos: Set<string> }>();
  for (const a of asignaciones) {
    const key = `${a.docenteId}-${a.curso.nivelId}`;
    if (!grupos.has(key)) {
      grupos.set(key, { nivel: a.curso.nivel.nombre, profesor: a.docente.nombre, materias: new Set(), cursos: new Set() });
    }
    const g = grupos.get(key)!;
    g.materias.add(a.materia.nombre);
    g.cursos.add(a.curso.nombre);
  }

  const filas = [...grupos.values()]
    .map((g) => ({
      nivel: g.nivel,
      profesor: g.profesor,
      materias: [...g.materias].sort().join(', '),
      cursos: [...g.cursos].sort().join(', '),
    }))
    .sort((a, b) => a.nivel.localeCompare(b.nivel) || a.profesor.localeCompare(b.profesor));

  return { nivelFiltro: nivelFiltroRow?.nombre ?? null, filas };
}

function renderPdf(doc: PDFKit.PDFDocument, data: Datos) {
  encabezadoReporte(
    doc,
    'Listado de Docentes por Nivel Educativo',
    data.nivelFiltro ? `Nivel: ${data.nivelFiltro}` : `Todos los niveles (${data.filas.length} filas)`,
  );

  tabla(
    doc,
    ['Nivel educativo', 'Profesor', 'Materias a cargo', 'Cursos'],
    [100, 120, 150, 130],
    data.filas.map((f) => [f.nivel, f.profesor, f.materias, f.cursos]),
  );
}

function nombreArchivo(data: Datos) {
  return data.nivelFiltro
    ? `listado-docentes-${data.nivelFiltro.replace(/[^\w-]+/g, '-')}.pdf`
    : 'listado-docentes-por-nivel.pdf';
}

export const listadoDocentesPorNivelStrategy: ReportStrategy<Params, Datos> = {
  key: 'listado-docentes-por-nivel',
  titulo: 'Listado de Docentes por Nivel Educativo',
  descripcion: 'Nivel, profesor, materias a cargo y cursos — filtrable por nivel.',
  rolesAutorizados: [Role.ADMIN],
  parseParams,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
