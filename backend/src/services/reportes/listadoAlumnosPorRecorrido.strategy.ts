import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import { CURSO_SELECT } from '../../utils/cursoLabel';
import type { ReportStrategy } from './types';
import { encabezadoReporte, seccion, tabla, horaLabel } from './pdfHelpers';

// TP — "Listado de alumnos por recorrido del servicio de transporte"
// (RF-33): agrupando alumnos por recorrido. InscripcionTransporte es
// @unique(estudianteId) (un alumno tiene a lo sumo un recorrido activo,
// ver comentario en schema.prisma), así que agrupar es trivial: una
// consulta por recorrido con sus inscripciones.

interface Params {
  recorridoId: number | null;
}

interface GrupoRecorrido {
  recorrido: string;
  horario: string;
  alumnos: { nombre: string; curso: string; nivel: string }[];
}

interface Datos {
  recorridoFiltro: string | null;
  grupos: GrupoRecorrido[];
}

function parseParams(req: Request): Params {
  if (req.query.recorridoId === undefined || req.query.recorridoId === '') return { recorridoId: null };
  const recorridoId = Number(req.query.recorridoId);
  if (!Number.isInteger(recorridoId) || recorridoId <= 0) throw HttpError.badRequest('El parámetro recorridoId es inválido.');
  return { recorridoId };
}

async function obtenerDatos({ recorridoId }: Params): Promise<Datos> {
  const recorridoFiltroRow = recorridoId ? await prisma.recorridoTransporte.findUnique({ where: { id: recorridoId } }) : null;
  if (recorridoId && !recorridoFiltroRow) throw HttpError.notFound('El recorrido indicado no existe.');

  const recorridos = await prisma.recorridoTransporte.findMany({
    where: recorridoId ? { id: recorridoId } : {},
    include: {
      inscripciones: {
        include: { estudiante: { select: { nombre: true, curso: { select: CURSO_SELECT } } } },
        orderBy: { estudiante: { nombre: 'asc' } },
      },
    },
    orderBy: { nombre: 'asc' },
  });

  return {
    recorridoFiltro: recorridoFiltroRow?.nombre ?? null,
    grupos: recorridos.map((r) => ({
      recorrido: r.nombre,
      horario: `Salida ${horaLabel(r.horaSalida)} · Regreso ${horaLabel(r.horaRegreso)}`,
      alumnos: r.inscripciones.map((i) => ({
        nombre: i.estudiante.nombre,
        curso: i.estudiante.curso?.nombre ?? '—',
        nivel: i.estudiante.curso?.nivel.nombre ?? '—',
      })),
    })),
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: Datos) {
  const totalAlumnos = data.grupos.reduce((acc, g) => acc + g.alumnos.length, 0);
  encabezadoReporte(
    doc,
    'Listado de Alumnos por Recorrido de Transporte',
    data.recorridoFiltro ? `Recorrido: ${data.recorridoFiltro}` : `Todos los recorridos (${totalAlumnos} alumnos)`,
  );

  data.grupos.forEach((g) => {
    seccion(doc, `${g.recorrido} — ${g.horario}`);
    tabla(
      doc,
      ['Alumno', 'Curso', 'Nivel educativo'],
      [190, 160, 150],
      g.alumnos.map((a) => [a.nombre, a.curso, a.nivel]),
    );
  });
}

function nombreArchivo(data: Datos) {
  return data.recorridoFiltro
    ? `listado-alumnos-${data.recorridoFiltro.replace(/[^\w-]+/g, '-')}.pdf`
    : 'listado-alumnos-por-recorrido.pdf';
}

export const listadoAlumnosPorRecorridoStrategy: ReportStrategy<Params, Datos> = {
  key: 'listado-alumnos-por-recorrido',
  titulo: 'Listado de Alumnos por Recorrido de Transporte',
  descripcion: 'Alumnos agrupados por recorrido de transporte, con horario de salida y regreso — filtrable por recorrido.',
  rolesAutorizados: [Role.ADMIN],
  parseParams,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
