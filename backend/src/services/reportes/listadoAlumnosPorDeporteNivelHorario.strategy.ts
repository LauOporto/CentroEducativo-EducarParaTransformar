import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import { CURSO_SELECT } from '../../utils/cursoLabel';
import type { ReportStrategy } from './types';
import { encabezadoReporte, tabla, DIA_LABEL, horaLabel } from './pdfHelpers';

// TP — "Listado de alumnos por deporte, nivel, horario y profesor a
// cargo" (RF-32): la variante más completa de RF-30/RF-31, sumando el
// día/horario y el docente responsable de CADA grupo (no del deporte en
// general — un mismo deporte puede tener varios GrupoDeporte con
// distinto día/profesor). Nivel y deporte quedan como filtros
// opcionales acá (a diferencia de RF-31, este reporte no exige nivel
// fijo: su diferencial es agregar columnas, no acotar el universo).

interface Params {
  nivelId: number | null;
  deporteId: number | null;
}

interface Fila {
  deporte: string;
  nivel: string;
  alumno: string;
  curso: string;
  dia: string;
  horario: string;
  profesor: string;
}

interface Datos {
  nivelFiltro: string | null;
  deporteFiltro: string | null;
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
    nivelId: parseOpcional(req.query.nivelId, 'nivelId'),
    deporteId: parseOpcional(req.query.deporteId, 'deporteId'),
  };
}

async function obtenerDatos({ nivelId, deporteId }: Params): Promise<Datos> {
  const [nivel, deporte] = await Promise.all([
    nivelId ? prisma.nivelEducativo.findUnique({ where: { id: nivelId } }) : null,
    deporteId ? prisma.deporte.findUnique({ where: { id: deporteId } }) : null,
  ]);
  if (nivelId && !nivel) throw HttpError.notFound('El nivel indicado no existe.');
  if (deporteId && !deporte) throw HttpError.notFound('El deporte indicado no existe.');

  const inscripciones = await prisma.inscripcionDeporte.findMany({
    where: {
      ...(deporteId ? { deporteId } : {}),
      ...(nivelId ? { grupoDeporte: { nivelId } } : {}),
    },
    include: {
      deporte: true,
      estudiante: { select: { nombre: true, curso: { select: CURSO_SELECT } } },
      grupoDeporte: { include: { nivel: true, docente: { select: { nombre: true } } } },
    },
    orderBy: [{ deporte: { nombre: 'asc' } }, { grupoDeporte: { nivel: { id: 'asc' } } }, { estudiante: { nombre: 'asc' } }],
  });

  return {
    nivelFiltro: nivel?.nombre ?? null,
    deporteFiltro: deporte?.nombre ?? null,
    filas: inscripciones.map((i) => ({
      deporte: i.deporte.nombre,
      nivel: i.grupoDeporte.nivel.nombre,
      alumno: i.estudiante.nombre,
      curso: i.estudiante.curso?.nombre ?? '—',
      dia: DIA_LABEL[i.grupoDeporte.diaSemana] ?? i.grupoDeporte.diaSemana,
      horario: `${horaLabel(i.grupoDeporte.horaInicio)} a ${horaLabel(i.grupoDeporte.horaFin)}`,
      profesor: i.grupoDeporte.docente.nombre,
    })),
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: Datos) {
  const partes = [
    data.deporteFiltro ? `Deporte: ${data.deporteFiltro}` : null,
    data.nivelFiltro ? `Nivel: ${data.nivelFiltro}` : null,
  ].filter(Boolean);
  encabezadoReporte(
    doc,
    'Listado de Alumnos por Deporte, Nivel, Horario y Profesor',
    partes.length ? partes.join(' · ') : `Todos los grupos (${data.filas.length} filas)`,
  );

  tabla(
    doc,
    ['Deporte', 'Nivel', 'Alumno', 'Curso', 'Día', 'Horario', 'Profesor'],
    [70, 60, 95, 65, 55, 75, 95],
    data.filas.map((f) => [f.deporte, f.nivel, f.alumno, f.curso, f.dia, f.horario, f.profesor]),
  );
}

function nombreArchivo() {
  return 'listado-alumnos-deporte-nivel-horario.pdf';
}

export const listadoAlumnosPorDeporteNivelHorarioStrategy: ReportStrategy<Params, Datos> = {
  key: 'listado-alumnos-por-deporte-nivel-horario',
  titulo: 'Listado de Alumnos por Deporte, Nivel, Horario y Profesor',
  descripcion: 'Deporte, nivel, alumno, curso, día, horario y profesor a cargo de cada grupo — filtrable por deporte y/o nivel.',
  rolesAutorizados: [Role.ADMIN],
  parseParams,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
