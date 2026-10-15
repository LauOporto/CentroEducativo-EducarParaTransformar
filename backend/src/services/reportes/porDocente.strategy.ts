import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import type { ReportStrategy } from './types';
import { encabezadoReporte, seccion, tabla, DIA_LABEL, horaLabel } from './pdfHelpers';

// TP — Plan de Trabajo, "Por Docente" (RF-26): "cursos a cargo agrupados
// por nivel educativo y los horarios de cada curso".
//
// Nota de alcance (verificada contra el modelo de datos real, no
// asumida): el sistema NO tiene un concepto de "horario de clase por
// materia/curso" en ningún lado — MateriaCurso no tiene campo de
// horario (fue una decisión deliberada al construir el Módulo
// Administrador: "el horario de una materia depende del curso, no se
// administra acá"). Inventar un horario ficticio sería peor que no
// mostrarlo. Se muestra entonces lo que SÍ es real: los cursos a cargo
// por nivel (vía MateriaCurso), y como horario real disponible, los
// grupos de deporte que el docente dicte (GrupoDeporte sí tiene
// horaInicio/horaFin), aclarado como una sección aparte.

interface Params {
  docenteId: number;
}

interface DatosPorDocente {
  docente: { nombre: string; email: string; dni: string };
  cursos: { nivel: string; curso: string; materia: string }[];
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
    select: { nombre: true, email: true, dni: true },
  });
  if (!docente) throw HttpError.notFound('Profesor no encontrado.');

  const [materiaCursos, gruposDeporte] = await Promise.all([
    prisma.materiaCurso.findMany({
      where: { docenteId },
      include: { materia: true, curso: { include: { nivel: true } } },
      orderBy: [{ curso: { nivel: { id: 'asc' } } }, { curso: { nombre: 'asc' } }, { materia: { nombre: 'asc' } }],
    }),
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

  seccion(doc, 'Cursos a cargo, agrupados por nivel educativo');
  tabla(
    doc,
    ['Nivel educativo', 'Curso', 'Materia'],
    [140, 140, 140],
    data.cursos.map((c) => [c.nivel, c.curso, c.materia]),
  );

  seccion(doc, 'Horarios de actividades deportivas a cargo');
  doc.fontSize(8.5).fillColor('#64748b').text(
    'El sistema no administra horario de clase por materia. Se muestran, en cambio, los horarios reales ' +
    'de los grupos de actividades deportivas que este profesor dicta, si corresponde.',
    { width: 460 },
  );
  doc.moveDown(0.4);
  doc.fontSize(10).fillColor('#1e293b');
  tabla(
    doc,
    ['Deporte', 'Nivel', 'Día', 'Horario'],
    [140, 120, 100, 100],
    data.gruposDeporte.map((g) => [g.deporte, g.nivel, g.dia, `${g.horaInicio} a ${g.horaFin}`]),
  );
}

function nombreArchivo(data: DatosPorDocente) {
  return `reporte-docente-${data.docente.nombre.replace(/[^\w-]+/g, '-')}.pdf`;
}

export const porDocenteStrategy: ReportStrategy<Params, DatosPorDocente> = {
  key: 'por-docente',
  titulo: 'Reporte por Docente',
  descripcion: 'Cursos a cargo agrupados por nivel educativo, y horarios de las actividades deportivas que dicta.',
  rolesAutorizados: [Role.ADMIN],
  parseParams,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
