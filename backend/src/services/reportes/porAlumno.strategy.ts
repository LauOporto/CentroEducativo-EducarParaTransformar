import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import { formatCursoLabel, CURSO_SELECT } from '../../utils/cursoLabel';
import type { ReportStrategy } from './types';
import { encabezadoReporte, seccion, tabla } from './pdfHelpers';

// TP-Metodologia-2, sección de Reportes — "Por alumno" debe mostrar:
// curso al que pertenece, materias que cursa, profesores de cada
// materia, deportes en los que participa, horarios de las actividades
// deportivas, uso del servicio de transporte y uso del servicio de
// comedor. Es un reporte de detalle de UNA entidad (no un listado tabular
// como los otros 7 "Listado de..."), por eso combina varias fuentes en
// vez de una sola consulta con columnas fijas.

const DIA_LABEL: Record<string, string> = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
};

const horaLabel = (d: Date) => d.toISOString().slice(11, 16);

interface Params {
  estudianteId: number;
}

interface DatosPorAlumno {
  alumno: {
    legajo: string | null;
    nombre: string;
    apellido: string | null;
    dni: string;
    estado: string | null;
    curso: string | null;
  };
  materias: { materia: string; docente: string }[];
  deportes: {
    deporte: string;
    nivel: string;
    dia: string;
    horaInicio: string;
    horaFin: string;
    docente: string;
  }[];
  transporte: { recorrido: string; horaSalida: string; horaRegreso: string } | null;
  comedor: { turno: string; horaInicio: string; horaFin: string } | null;
}

function parseParams(req: Request): Params {
  const estudianteId = Number(req.query.estudianteId);
  if (!Number.isInteger(estudianteId) || estudianteId <= 0) {
    throw HttpError.badRequest('Falta el parámetro estudianteId.');
  }
  return { estudianteId };
}

async function obtenerDatos({ estudianteId }: Params): Promise<DatosPorAlumno> {
  const alumno = await prisma.user.findFirst({
    where: { id: estudianteId, role: Role.ESTUDIANTE },
    select: {
      id: true, legajo: true, nombre: true, apellido: true, dni: true, estado: true,
      cursoId: true, curso: { select: CURSO_SELECT },
    },
  });
  if (!alumno) throw HttpError.notFound('Alumno no encontrado.');

  const materiaCursos = alumno.cursoId
    ? await prisma.materiaCurso.findMany({
        where: { cursoId: alumno.cursoId },
        include: { materia: true, docente: { select: { nombre: true } } },
        orderBy: { materia: { nombre: 'asc' } },
      })
    : [];

  const inscripcionesDeporte = await prisma.inscripcionDeporte.findMany({
    where: { estudianteId },
    include: {
      grupoDeporte: {
        include: { deporte: true, nivel: true, docente: { select: { nombre: true } } },
      },
    },
  });

  const [transporte, comedor] = await Promise.all([
    prisma.inscripcionTransporte.findUnique({ where: { estudianteId }, include: { recorrido: true } }),
    prisma.inscripcionComedor.findUnique({ where: { estudianteId }, include: { turno: true } }),
  ]);

  return {
    alumno: {
      legajo: alumno.legajo,
      nombre: alumno.nombre,
      apellido: alumno.apellido,
      dni: alumno.dni,
      estado: alumno.estado,
      curso: formatCursoLabel(alumno.curso),
    },
    materias: materiaCursos.map((mc) => ({ materia: mc.materia.nombre, docente: mc.docente.nombre })),
    deportes: inscripcionesDeporte.map((i) => ({
      deporte: i.grupoDeporte.deporte.nombre,
      nivel: i.grupoDeporte.nivel.nombre,
      dia: DIA_LABEL[i.grupoDeporte.diaSemana] ?? i.grupoDeporte.diaSemana,
      horaInicio: horaLabel(i.grupoDeporte.horaInicio),
      horaFin: horaLabel(i.grupoDeporte.horaFin),
      docente: i.grupoDeporte.docente.nombre,
    })),
    transporte: transporte
      ? { recorrido: transporte.recorrido.nombre, horaSalida: horaLabel(transporte.recorrido.horaSalida), horaRegreso: horaLabel(transporte.recorrido.horaRegreso) }
      : null,
    comedor: comedor
      ? { turno: comedor.turno.nombre, horaInicio: horaLabel(comedor.turno.horaInicio), horaFin: horaLabel(comedor.turno.horaFin) }
      : null,
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: DatosPorAlumno) {
  encabezadoReporte(doc, 'Reporte por Alumno');

  seccion(doc, 'Datos del alumno');
  const { alumno } = data;
  const nombreCompleto = [alumno.apellido, alumno.nombre].filter(Boolean).join(', ') || alumno.nombre;
  doc.text(`Legajo: ${alumno.legajo ?? '—'}`);
  doc.text(`Nombre: ${nombreCompleto}`);
  doc.text(`DNI: ${alumno.dni}`);
  doc.text(`Curso: ${alumno.curso ?? 'Sin curso asignado'}`);
  doc.text(`Estado: ${alumno.estado ?? '—'}`);

  seccion(doc, 'Materias que cursa y profesor a cargo');
  tabla(doc, ['Materia', 'Profesor a cargo'], [250, 250], data.materias.map((m) => [m.materia, m.docente]));

  seccion(doc, 'Deportes en los que participa y horarios');
  tabla(
    doc,
    ['Deporte', 'Nivel', 'Día', 'Horario', 'Profesor'],
    [95, 85, 70, 90, 135],
    data.deportes.map((d) => [d.deporte, d.nivel, d.dia, `${d.horaInicio} a ${d.horaFin}`, d.docente]),
  );

  seccion(doc, 'Uso del servicio de transporte');
  doc.text(
    data.transporte
      ? `${data.transporte.recorrido} (salida ${data.transporte.horaSalida}, regreso ${data.transporte.horaRegreso})`
      : 'No utiliza el servicio de transporte.',
  );

  seccion(doc, 'Uso del servicio de comedor');
  doc.text(
    data.comedor
      ? `${data.comedor.turno} (${data.comedor.horaInicio} a ${data.comedor.horaFin})`
      : 'No utiliza el servicio de comedor.',
  );
}

function nombreArchivo(data: DatosPorAlumno) {
  const legajo = data.alumno.legajo ?? String(data.alumno.dni);
  return `reporte-alumno-${legajo}.pdf`;
}

export const porAlumnoStrategy: ReportStrategy<Params, DatosPorAlumno> = {
  key: 'por-alumno',
  titulo: 'Reporte por Alumno',
  descripcion: 'Curso, materias con profesor a cargo, deportes con horarios, transporte y comedor de un alumno.',
  rolesAutorizados: [Role.ADMIN],
  parseParams,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
