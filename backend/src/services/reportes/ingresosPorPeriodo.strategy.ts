import { Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { CURSO_SELECT, formatCursoLabel } from '../../utils/cursoLabel';
import { diaSiguiente, fechaISO, inicioDiaArgentina, ZONA_NEGOCIO } from '../../utils/fechas';
import { HttpError } from '../../utils/httpError';
import { formatearPesos, sumar, toMonto } from '../../utils/montos';
import { bloqueTotales, tablaItems } from '../facturaPdf.service';
import { fechaCorta, parseParamsPeriodoAlumno, rangoLabel, type ParamsPeriodoAlumno } from './financieros.helpers';
import { encabezadoReporte, seccion } from './pdfHelpers';
import type { ReportStrategy } from './types';

// RF-52 (D10, Listado 1): "Ingresos por período de tiempo".
// Fuente: tabla Pago (se crea únicamente cuando el Administrador aprueba un
// comprobante de transferencia), filtrada por fechaAcreditacion en el rango
// [desde, hasta] en la zona horaria de Argentina, agrupada por año de
// acreditación y por alumno, con subtotales y total general.

export interface FilaIngreso {
  fechaAcreditacion: string; // "AAAA-MM-DD" en Argentina
  comprobanteNumero: string;
  facturaNumero: string;
  periodo: string;
  monto: number;
}

export interface GrupoAlumnoIngresos {
  estudianteId: number;
  alumno: string;
  legajo: string | null;
  curso: string | null;
  subtotal: number;
  pagos: FilaIngreso[];
}

export interface GrupoAnioIngresos {
  anio: string;
  subtotal: number;
  alumnos: GrupoAlumnoIngresos[];
}

export interface DatosIngresosPorPeriodo {
  desde: string;
  hasta: string;
  alumnoFiltro: string | null;
  totalGeneral: number;
  anios: GrupoAnioIngresos[];
}

function fechaArgentinaISO(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

async function obtenerDatos({ desde, hasta, estudianteId }: ParamsPeriodoAlumno): Promise<DatosIngresosPorPeriodo> {
  const alumnoRow = estudianteId
    ? await prisma.user.findFirst({
        where: { id: estudianteId, role: Role.ESTUDIANTE },
        select: { id: true, nombre: true },
      })
    : null;
  if (estudianteId && !alumnoRow) throw HttpError.notFound('El alumno indicado no existe.');

  const pagos = await prisma.pago.findMany({
    where: {
      ...(estudianteId ? { estudianteId } : {}),
      fechaAcreditacion: {
        gte: inicioDiaArgentina(desde),
        lt: inicioDiaArgentina(diaSiguiente(hasta)),
      },
    },
    include: {
      estudiante: { select: { id: true, nombre: true, legajo: true, curso: { select: CURSO_SELECT } } },
      comprobante: { select: { numero: true } },
      factura: { select: { numero: true, periodo: true } },
    },
    orderBy: [{ fechaAcreditacion: 'asc' }, { id: 'asc' }],
  });

  const porAnio = new Map<
    string,
    Map<
      number,
      {
        alumno: string;
        legajo: string | null;
        curso: string | null;
        montos: (typeof pagos)[number]['monto'][];
        pagos: FilaIngreso[];
      }
    >
  >();

  for (const p of pagos) {
    const fechaAcred = fechaArgentinaISO(p.fechaAcreditacion);
    const anio = fechaAcred.slice(0, 4);
    if (!porAnio.has(anio)) porAnio.set(anio, new Map());
    const mapaAlumnos = porAnio.get(anio)!;
    if (!mapaAlumnos.has(p.estudianteId)) {
      mapaAlumnos.set(p.estudianteId, {
        alumno: p.estudiante.nombre,
        legajo: p.estudiante.legajo,
        curso: formatCursoLabel(p.estudiante.curso),
        montos: [],
        pagos: [],
      });
    }
    const entry = mapaAlumnos.get(p.estudianteId)!;
    entry.montos.push(p.monto);
    entry.pagos.push({
      fechaAcreditacion: fechaAcred || fechaISO(p.fechaAcreditacion),
      comprobanteNumero: p.comprobante.numero,
      facturaNumero: p.factura.numero,
      periodo: p.factura.periodo,
      monto: toMonto(p.monto),
    });
  }

  const anios: GrupoAnioIngresos[] = [...porAnio.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([anio, mapaAlumnos]) => {
      const alumnos: GrupoAlumnoIngresos[] = [...mapaAlumnos.entries()]
        .map(([id, g]) => ({
          estudianteId: id,
          alumno: g.alumno,
          legajo: g.legajo,
          curso: g.curso,
          subtotal: toMonto(sumar(g.montos)),
          pagos: g.pagos,
        }))
        .sort((a, b) => a.alumno.localeCompare(b.alumno));
      return {
        anio,
        subtotal: toMonto(sumar(alumnos.map((a) => a.subtotal))),
        alumnos,
      };
    });

  return {
    desde,
    hasta,
    alumnoFiltro: alumnoRow?.nombre ?? null,
    totalGeneral: toMonto(sumar(pagos.map((p) => p.monto))),
    anios,
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: DatosIngresosPorPeriodo) {
  const subtitulo = [rangoLabel(data), data.alumnoFiltro ? `Alumno: ${data.alumnoFiltro}` : null]
    .filter(Boolean)
    .join(' · ');
  encabezadoReporte(doc, 'Reporte de Ingresos por Período', subtitulo);

  if (data.anios.length === 0) {
    seccion(doc, 'Sin ingresos registrados en el período');
    return;
  }

  for (const grupoAnio of data.anios) {
    seccion(doc, `Año ${grupoAnio.anio} — Subtotal: ${formatearPesos(grupoAnio.subtotal)}`);
    for (const al of grupoAnio.alumnos) {
      doc.moveDown(0.3);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(
          `${al.alumno}${al.legajo ? ` (${al.legajo})` : ''}${al.curso ? ` — ${al.curso}` : ''} · Subtotal: ${formatearPesos(al.subtotal)}`,
        );
      doc.moveDown(0.2);
      tablaItems(
        doc,
        {
          titulos: ['Fecha acreditación', 'Comprobante', 'Factura', 'Período', 'Monto'],
          anchos: [95, 130, 125, 70, 95],
          derecha: [4],
        },
        al.pagos.map((p) => [
          fechaCorta(p.fechaAcreditacion),
          p.comprobanteNumero,
          p.facturaNumero,
          p.periodo,
          formatearPesos(p.monto),
        ]),
      );
    }
  }

  doc.moveDown(0.8);
  bloqueTotales(doc, [['Total ingresos', formatearPesos(data.totalGeneral), true]]);
}

function nombreArchivo(data: DatosIngresosPorPeriodo) {
  return `ingresos-${data.desde}-a-${data.hasta}.pdf`;
}

export const ingresosPorPeriodoStrategy: ReportStrategy<ParamsPeriodoAlumno, DatosIngresosPorPeriodo> = {
  key: 'ingresos-por-periodo',
  titulo: 'Ingresos por Período',
  descripcion:
    'Pagos acreditados en el período de fechas, agrupados por año y por alumno, con subtotales y total general.',
  rolesAutorizados: [Role.ADMIN],
  parseParams: parseParamsPeriodoAlumno,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
