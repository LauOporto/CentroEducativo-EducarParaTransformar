import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import type { ReportStrategy } from './types';
import { encabezadoReporte, tabla } from './pdfHelpers';

// TP — "Listado de alumnos por materia" (RF-28): Nivel educativo, Curso,
// Materia, Profesor a cargo, Alumno, Legajo. Cada alumno cursa TODAS las
// materias asignadas a su curso (MateriaCurso), así que una fila es
// (asignación materia-curso-profesor) × (alumno de ese curso).

interface Params {
  materiaId: number | null;
  cursoId: number | null;
}

interface Fila {
  nivel: string;
  curso: string;
  materia: string;
  profesor: string;
  alumno: string;
  legajo: string;
}

interface Datos {
  materiaFiltro: string | null;
  cursoFiltro: string | null;
  filas: Fila[];
}

function parseParams(req: Request): Params {
  const parseOpcional = (v: unknown, nombre: string) => {
    if (v === undefined || v === '') return null;
    const n = Number(v);
    if (!Number.isInteger(n) || n <= 0) throw HttpError.badRequest(`El parámetro ${nombre} es inválido.`);
    return n;
  };
  return {
    materiaId: parseOpcional(req.query.materiaId, 'materiaId'),
    cursoId: parseOpcional(req.query.cursoId, 'cursoId'),
  };
}

async function obtenerDatos({ materiaId, cursoId }: Params): Promise<Datos> {
  const [materia, curso] = await Promise.all([
    materiaId ? prisma.materia.findUnique({ where: { id: materiaId } }) : null,
    cursoId ? prisma.curso.findUnique({ where: { id: cursoId }, include: { nivel: true } }) : null,
  ]);
  if (materiaId && !materia) throw HttpError.notFound('La materia indicada no existe.');
  if (cursoId && !curso) throw HttpError.notFound('El curso indicado no existe.');

  const asignaciones = await prisma.materiaCurso.findMany({
    where: {
      ...(materiaId ? { materiaId } : {}),
      ...(cursoId ? { cursoId } : {}),
    },
    include: {
      materia: true,
      docente: { select: { nombre: true } },
      curso: {
        include: {
          nivel: true,
          alumnos: {
            where: { role: Role.ESTUDIANTE, isActive: true },
            select: { nombre: true, legajo: true },
            orderBy: { nombre: 'asc' },
          },
        },
      },
    },
    orderBy: [{ curso: { nivel: { id: 'asc' } } }, { curso: { nombre: 'asc' } }, { materia: { nombre: 'asc' } }],
  });

  const filas: Fila[] = [];
  for (const a of asignaciones) {
    for (const alumno of a.curso.alumnos) {
      filas.push({
        nivel: a.curso.nivel.nombre,
        curso: a.curso.nombre,
        materia: a.materia.nombre,
        profesor: a.docente.nombre,
        alumno: alumno.nombre,
        legajo: alumno.legajo ?? '—',
      });
    }
  }

  return {
    materiaFiltro: materia?.nombre ?? null,
    cursoFiltro: curso ? `${curso.nivel.nombre} — ${curso.nombre}` : null,
    filas,
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: Datos) {
  const partesSubtitulo = [
    data.materiaFiltro ? `Materia: ${data.materiaFiltro}` : null,
    data.cursoFiltro ? `Curso: ${data.cursoFiltro}` : null,
  ].filter(Boolean);
  encabezadoReporte(
    doc,
    'Listado de Alumnos por Materia',
    partesSubtitulo.length ? partesSubtitulo.join(' · ') : `Todas las materias (${data.filas.length} filas)`,
  );

  tabla(
    doc,
    ['Nivel', 'Curso', 'Materia', 'Profesor', 'Alumno', 'Legajo'],
    [65, 75, 110, 100, 100, 70],
    data.filas.map((f) => [f.nivel, f.curso, f.materia, f.profesor, f.alumno, f.legajo]),
  );
}

function nombreArchivo(data: Datos) {
  return data.materiaFiltro
    ? `listado-alumnos-${data.materiaFiltro.replace(/[^\w-]+/g, '-')}.pdf`
    : 'listado-alumnos-por-materia.pdf';
}

export const listadoAlumnosPorMateriaStrategy: ReportStrategy<Params, Datos> = {
  key: 'listado-alumnos-por-materia',
  titulo: 'Listado de Alumnos por Materia',
  descripcion: 'Nivel, curso, materia, profesor a cargo, alumno y legajo — filtrable por materia y/o curso.',
  rolesAutorizados: [Role.ADMIN],
  parseParams,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
