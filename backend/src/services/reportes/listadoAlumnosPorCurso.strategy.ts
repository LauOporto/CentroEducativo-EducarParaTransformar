import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import { formatCursoLabel, CURSO_SELECT } from '../../utils/cursoLabel';
import type { ReportStrategy } from './types';
import { encabezadoReporte, tabla } from './pdfHelpers';

// TP-Metodologia-2, sección de Reportes — "Listado de alumnos por curso"
// debe mostrar: Nivel educativo, Curso, Legajo, Apellido, Nombre. Es un
// listado tabular plano (a diferencia de "Por alumno", que es un reporte
// de detalle de una sola entidad) — por default trae TODA la matrícula
// ordenada por nivel y curso; el parámetro opcional cursoId permite
// acotarlo a un único curso sin duplicar la estrategia.

interface Params {
  cursoId: number | null;
}

interface FilaAlumno {
  nivel: string;
  curso: string;
  legajo: string;
  apellido: string;
  nombre: string;
}

interface DatosListado {
  cursoFiltro: string | null;
  filas: FilaAlumno[];
}

function parseParams(req: Request): Params {
  if (req.query.cursoId === undefined || req.query.cursoId === '') return { cursoId: null };
  const cursoId = Number(req.query.cursoId);
  if (!Number.isInteger(cursoId) || cursoId <= 0) {
    throw HttpError.badRequest('El parámetro cursoId es inválido.');
  }
  return { cursoId };
}

async function obtenerDatos({ cursoId }: Params): Promise<DatosListado> {
  let cursoFiltro: string | null = null;
  if (cursoId) {
    const curso = await prisma.curso.findUnique({ where: { id: cursoId }, select: CURSO_SELECT });
    if (!curso) throw HttpError.notFound('El curso indicado no existe.');
    cursoFiltro = formatCursoLabel(curso);
  }

  const alumnos = await prisma.user.findMany({
    where: {
      role: Role.ESTUDIANTE,
      isActive: true,
      cursoId: cursoId ?? { not: null },
    },
    select: {
      legajo: true,
      apellido: true,
      nombre: true,
      curso: { select: { nombre: true, nivel: { select: { id: true, nombre: true } } } },
    },
    orderBy: [
      { curso: { nivel: { id: 'asc' } } },
      { curso: { nombre: 'asc' } },
      { apellido: 'asc' },
    ],
  });

  return {
    cursoFiltro,
    filas: alumnos.map((a) => ({
      nivel: a.curso?.nivel.nombre ?? '—',
      curso: a.curso?.nombre ?? '—',
      legajo: a.legajo ?? '—',
      apellido: a.apellido ?? '—',
      nombre: a.nombre,
    })),
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: DatosListado) {
  encabezadoReporte(
    doc,
    'Listado de Alumnos por Curso',
    data.cursoFiltro ? `Curso: ${data.cursoFiltro}` : `Todos los cursos (${data.filas.length} alumnos)`,
  );

  tabla(
    doc,
    ['Nivel educativo', 'Curso', 'Legajo', 'Apellido', 'Nombre'],
    [110, 110, 90, 100, 105],
    data.filas.map((f) => [f.nivel, f.curso, f.legajo, f.apellido, f.nombre]),
  );
}

function nombreArchivo(data: DatosListado) {
  return data.cursoFiltro
    ? `listado-alumnos-${data.cursoFiltro.replace(/[^\w-]+/g, '-')}.pdf`
    : 'listado-alumnos-por-curso.pdf';
}

export const listadoAlumnosPorCursoStrategy: ReportStrategy<Params, DatosListado> = {
  key: 'listado-alumnos-por-curso',
  titulo: 'Listado de Alumnos por Curso',
  descripcion: 'Nivel, curso, legajo, apellido y nombre de los alumnos — de toda la matrícula o de un curso puntual.',
  rolesAutorizados: [Role.ADMIN],
  parseParams,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
