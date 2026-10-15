import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import { CURSO_SELECT } from '../../utils/cursoLabel';
import type { ReportStrategy } from './types';
import { encabezadoReporte, tabla } from './pdfHelpers';

// TP — "Listado de alumnos por deporte y por nivel" (RF-31): el reporte
// anterior (RF-30, listadoAlumnosPorDeporte.strategy.ts) filtrado por
// nivel educativo. A diferencia de RF-30, acá el nivel es OBLIGATORIO
// (es literalmente el requisito del reporte); deporteId sigue siendo
// opcional.

interface Params {
  nivelId: number;
  deporteId: number | null;
}

interface Fila {
  deporte: string;
  alumno: string;
  curso: string;
}

interface Datos {
  nivel: string;
  deporteFiltro: string | null;
  filas: Fila[];
}

function parseParams(req: Request): Params {
  const nivelId = Number(req.query.nivelId);
  if (!Number.isInteger(nivelId) || nivelId <= 0) {
    throw HttpError.badRequest('Falta el parámetro nivelId.');
  }
  let deporteId: number | null = null;
  if (req.query.deporteId !== undefined && req.query.deporteId !== '') {
    deporteId = Number(req.query.deporteId);
    if (!Number.isInteger(deporteId) || deporteId <= 0) throw HttpError.badRequest('El parámetro deporteId es inválido.');
  }
  return { nivelId, deporteId };
}

async function obtenerDatos({ nivelId, deporteId }: Params): Promise<Datos> {
  const [nivel, deporte] = await Promise.all([
    prisma.nivelEducativo.findUnique({ where: { id: nivelId } }),
    deporteId ? prisma.deporte.findUnique({ where: { id: deporteId } }) : null,
  ]);
  if (!nivel) throw HttpError.notFound('El nivel indicado no existe.');
  if (deporteId && !deporte) throw HttpError.notFound('El deporte indicado no existe.');

  const inscripciones = await prisma.inscripcionDeporte.findMany({
    where: {
      ...(deporteId ? { deporteId } : {}),
      estudiante: { curso: { nivelId } },
    },
    include: {
      deporte: true,
      estudiante: { select: { nombre: true, curso: { select: CURSO_SELECT } } },
    },
    orderBy: [{ deporte: { nombre: 'asc' } }, { estudiante: { nombre: 'asc' } }],
  });

  return {
    nivel: nivel.nombre,
    deporteFiltro: deporte?.nombre ?? null,
    filas: inscripciones.map((i) => ({
      deporte: i.deporte.nombre,
      alumno: i.estudiante.nombre,
      curso: i.estudiante.curso?.nombre ?? '—',
    })),
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: Datos) {
  encabezadoReporte(
    doc,
    'Listado de Alumnos por Deporte y Nivel',
    data.deporteFiltro ? `Nivel: ${data.nivel} · Deporte: ${data.deporteFiltro}` : `Nivel: ${data.nivel} (${data.filas.length} filas)`,
  );

  tabla(
    doc,
    ['Deporte', 'Alumno', 'Curso'],
    [150, 180, 170],
    data.filas.map((f) => [f.deporte, f.alumno, f.curso]),
  );
}

function nombreArchivo(data: Datos) {
  return `listado-alumnos-deporte-${data.nivel.replace(/[^\w-]+/g, '-')}.pdf`;
}

export const listadoAlumnosPorDeporteYNivelStrategy: ReportStrategy<Params, Datos> = {
  key: 'listado-alumnos-por-deporte-y-nivel',
  titulo: 'Listado de Alumnos por Deporte y Nivel',
  descripcion: 'Deporte, alumno y curso, agrupado por nivel educativo (obligatorio) y filtrable por deporte.',
  rolesAutorizados: [Role.ADMIN],
  parseParams,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
