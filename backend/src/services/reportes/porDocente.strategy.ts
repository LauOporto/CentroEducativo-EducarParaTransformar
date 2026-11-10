import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import { listarHorarios } from '../horarios.service';
import type { ReportStrategy } from './types';
import { encabezadoReporte, seccion, tabla, DIA_LABEL, horaLabel } from './pdfHelpers';

// TP — "Por docente: cursos a cargo por nivel y horarios de cada curso"
// (RF-26). Los cursos salen de MateriaCurso y los horarios del horario de
// cursado (HorarioCurso), que administra el Admin en Académico → Horarios.
// Si el profesor además dirige grupos de deporte, se listan aparte.

interface Params {
  docenteId: number;
}

interface DatosPorDocente {
  docente: { nombre: string; email: string; dni: string; especialidad: string | null };
  cursos: { nivel: string; curso: string; materia: string }[];
  horarios: { nivel: string; curso: string; materia: string; dia: string; horaInicio: string; horaFin: string }[];
  gruposDeporte: { deporte: string; nivel: string; dia: string; horaInicio: string; horaFin: string }[];
}

function parseParams(req: Request): Params {
  const docenteId = Number(req.query.docenteId);
  if (!Number.isInteger(docenteId) || docenteId <= 0) {
    throw HttpError.badRequest('Falta el parámetro docenteId.');
  }
  return { docenteId };
}

async function obtenerDatos({ docenteId }: Params): Promise<DatosPorDocente> {
  const docente = await prisma.user.findFirst({
    where: { id: docenteId, role: Role.DOCENTE },
    select: { nombre: true, email: true, dni: true, especialidad: true },
  });
  if (!docente) throw HttpError.notFound('Profesor no encontrado.');

  const [materiaCursos, horarios, gruposDeporte] = await Promise.all([
    prisma.materiaCurso.findMany({
      where: { docenteId },
      include: { materia: true, curso: { include: { nivel: true } } },
      orderBy: [{ curso: { nivel: { id: 'asc' } } }, { curso: { nombre: 'asc' } }, { materia: { nombre: 'asc' } }],
    }),
    listarHorarios({ docenteId }),
    prisma.grupoDeporte.findMany({
      where: { docenteId },
      include: { deporte: true, nivel: true },
      orderBy: [{ nivel: { id: 'asc' } }, { deporte: { nombre: 'asc' } }],
    }),
  ]);

  return {
    docente,
    cursos: materiaCursos.map((mc) => ({
      nivel: mc.curso.nivel.nombre,
      curso: mc.curso.nombre,
      materia: mc.materia.nombre,
    })),
    // Agrupado por curso (nivel → curso) y, dentro de cada curso, por día y hora.
    horarios: [...horarios]
      .sort((a, b) => a.curso.localeCompare(b.curso))
      .map((h) => ({
        nivel: h.nivel,
        curso: h.curso.split(' — ').slice(1).join(' — ') || h.curso,
        materia: h.materia,
        dia: DIA_LABEL[h.diaSemana] ?? h.diaSemana,
        horaInicio: h.horaInicio,
        horaFin: h.horaFin,
      })),
    gruposDeporte: gruposDeporte.map((g) => ({
      deporte: g.deporte.nombre,
      nivel: g.nivel.nombre,
      dia: DIA_LABEL[g.diaSemana] ?? g.diaSemana,
      horaInicio: horaLabel(g.horaInicio),
      horaFin: horaLabel(g.horaFin),
    })),
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: DatosPorDocente) {
  encabezadoReporte(doc, 'Reporte por Docente');

  seccion(doc, 'Datos del profesor');
  doc.text(`Nombre: ${data.docente.nombre}`);
  doc.text(`DNI: ${data.docente.dni}`);
  doc.text(`Email: ${data.docente.email}`);
  if (data.docente.especialidad) doc.text(`Especialidad: ${data.docente.especialidad}`);

  seccion(doc, 'Cursos a cargo, agrupados por nivel educativo');
  tabla(
    doc,
    ['Nivel educativo', 'Curso', 'Materia'],
    [140, 140, 140],
    data.cursos.map((c) => [c.nivel, c.curso, c.materia]),
  );

  seccion(doc, 'Horarios de cada curso');
  tabla(
    doc,
    ['Nivel', 'Curso', 'Materia', 'Día', 'Horario'],
    [80, 90, 120, 70, 90],
    data.horarios.map((h) => [h.nivel, h.curso, h.materia, h.dia, `${h.horaInicio} a ${h.horaFin}`]),
  );

  if (data.gruposDeporte.length > 0) {
    seccion(doc, 'Actividades deportivas a cargo');
    tabla(
      doc,
      ['Deporte', 'Nivel', 'Día', 'Horario'],
      [140, 120, 100, 100],
      data.gruposDeporte.map((g) => [g.deporte, g.nivel, g.dia, `${g.horaInicio} a ${g.horaFin}`]),
    );
  }
}

function nombreArchivo(data: DatosPorDocente) {
  return `reporte-docente-${data.docente.nombre.replace(/[^\w-]+/g, '-')}.pdf`;
}

export const porDocenteStrategy: ReportStrategy<Params, DatosPorDocente> = {
  key: 'por-docente',
  titulo: 'Reporte por Docente',
  descripcion: 'Cursos a cargo agrupados por nivel educativo y horario de cursado de cada curso.',
  rolesAutorizados: [Role.ADMIN],
  parseParams,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
