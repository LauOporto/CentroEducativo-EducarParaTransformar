import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import { CURSO_SELECT } from '../../utils/cursoLabel';
import type { ReportStrategy } from './types';
import { encabezadoReporte, tabla } from './pdfHelpers';

// TP — "Listado de alumnos por deporte" (RF-30): Deporte, Alumno, Curso,
// Nivel educativo. Es la base de la que RF-31 y RF-32 son variaciones
// progresivas (por eso comparten forma pero viven en archivos propios).

interface Params {
  deporteId: number | null;
}

interface Fila {
  deporte: string;
  alumno: string;
  curso: string;
  nivel: string;
}

interface Datos {
  deporteFiltro: string | null;
  filas: Fila[];
}

function parseParams(req: Request): Params {
  if (req.query.deporteId === undefined || req.query.deporteId === '') return { deporteId: null };
  const deporteId = Number(req.query.deporteId);
  if (!Number.isInteger(deporteId) || deporteId <= 0) throw HttpError.badRequest('El parámetro deporteId es inválido.');
  return { deporteId };
}

async function obtenerDatos({ deporteId }: Params): Promise<Datos> {
  const deporte = deporteId ? await prisma.deporte.findUnique({ where: { id: deporteId } }) : null;
  if (deporteId && !deporte) throw HttpError.notFound('El deporte indicado no existe.');

  const inscripciones = await prisma.inscripcionDeporte.findMany({
    where: deporteId ? { deporteId } : {},
    include: {
      deporte: true,
      estudiante: { select: { nombre: true, curso: { select: CURSO_SELECT } } },
    },
    orderBy: [{ deporte: { nombre: 'asc' } }, { estudiante: { nombre: 'asc' } }],
  });

  return {
    deporteFiltro: deporte?.nombre ?? null,
    filas: inscripciones.map((i) => ({
      deporte: i.deporte.nombre,
      alumno: i.estudiante.nombre,
      curso: i.estudiante.curso?.nombre ?? '—',
      nivel: i.estudiante.curso?.nivel.nombre ?? '—',
    })),
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: Datos) {
  encabezadoReporte(
    doc,
    'Listado de Alumnos por Deporte',
    data.deporteFiltro ? `Deporte: ${data.deporteFiltro}` : `Todos los deportes (${data.filas.length} filas)`,
  );

  tabla(
    doc,
    ['Deporte', 'Alumno', 'Curso', 'Nivel educativo'],
    [120, 150, 110, 120],
    data.filas.map((f) => [f.deporte, f.alumno, f.curso, f.nivel]),
  );
}

function nombreArchivo(data: Datos) {
  return data.deporteFiltro
    ? `listado-alumnos-${data.deporteFiltro.replace(/[^\w-]+/g, '-')}.pdf`
    : 'listado-alumnos-por-deporte.pdf';
}

export const listadoAlumnosPorDeporteStrategy: ReportStrategy<Params, Datos> = {
  key: 'listado-alumnos-por-deporte',
  titulo: 'Listado de Alumnos por Deporte',
  descripcion: 'Deporte, alumno, curso y nivel educativo — filtrable por deporte.',
  rolesAutorizados: [Role.ADMIN],
  parseParams,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
