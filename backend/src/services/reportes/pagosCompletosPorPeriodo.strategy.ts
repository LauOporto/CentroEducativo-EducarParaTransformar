import { EstadoFactura, Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { CURSO_SELECT, formatCursoLabel } from '../../utils/cursoLabel';
import { fechaISO, fechaUTC } from '../../utils/fechas';
import { HttpError } from '../../utils/httpError';
import { formatearPesos, sumar, toMonto } from '../../utils/montos';
import { bloqueTotales, tablaItems } from '../facturaPdf.service';
import { fechaCorta, parseParamsPeriodoAlumno, rangoLabel, type ParamsPeriodoAlumno } from './financieros.helpers';
import { encabezadoReporte, seccion } from './pdfHelpers';
import type { ReportStrategy } from './types';

// RF-52 (D10, Listado 2): "Pagos completos por período de tiempo, por año y
// por alumno".
// Fuente: facturas en estado PAGADA con vencimiento dentro del rango
// [desde, hasta], agrupadas por año del período facturado y por alumno.

export interface FilaPagoCompleto {
  facturaNumero: string;
  periodo: string;
  vencimiento: string;
  total: number;
  pagado: number;
}

export interface GrupoAlumnoPagosCompletos {
  estudianteId: number;
  alumno: string;
  legajo: string | null;
  curso: string | null;
  subtotal: number;
  facturas: FilaPagoCompleto[];
}

export interface GrupoAnioPagosCompletos {
  anio: string;
  subtotal: number;
  alumnos: GrupoAlumnoPagosCompletos[];
}

export interface DatosPagosCompletos {
  desde: string;
  hasta: string;
  alumnoFiltro: string | null;
  totalGeneral: number;
  anios: GrupoAnioPagosCompletos[];
}

async function obtenerDatos({ desde, hasta, estudianteId }: ParamsPeriodoAlumno): Promise<DatosPagosCompletos> {
  const alumnoRow = estudianteId
    ? await prisma.user.findFirst({
        where: { id: estudianteId, role: Role.ESTUDIANTE },
        select: { id: true, nombre: true },
      })
    : null;
  if (estudianteId && !alumnoRow) throw HttpError.notFound('El alumno indicado no existe.');

  const facturas = await prisma.factura.findMany({
    where: {
      estado: EstadoFactura.PAGADA,
      ...(estudianteId ? { estudianteId } : {}),
      vencimiento: { gte: fechaUTC(desde), lte: fechaUTC(hasta) },
    },
    include: {
      estudiante: { select: { id: true, nombre: true, legajo: true, curso: { select: CURSO_SELECT } } },
      pagos: { select: { monto: true } },
    },
    orderBy: [{ periodo: 'asc' }, { id: 'asc' }],
  });

  const porAnio = new Map<
    string,
    Map<
      number,
      {
        alumno: string;
        legajo: string | null;
        curso: string | null;
        totales: (typeof facturas)[number]['total'][];
        facturas: FilaPagoCompleto[];
      }
    >
  >();

  for (const f of facturas) {
    const anio = f.periodo.slice(0, 4);
    if (!porAnio.has(anio)) porAnio.set(anio, new Map());
    const mapaAlumnos = porAnio.get(anio)!;
    if (!mapaAlumnos.has(f.estudianteId)) {
      mapaAlumnos.set(f.estudianteId, {
        alumno: f.estudiante.nombre,
        legajo: f.estudiante.legajo,
        curso: formatCursoLabel(f.estudiante.curso),
        totales: [],
        facturas: [],
      });
    }
    const entry = mapaAlumnos.get(f.estudianteId)!;
    const pagado = sumar(f.pagos.map((p) => p.monto));
    entry.totales.push(f.total);
    entry.facturas.push({
      facturaNumero: f.numero,
      periodo: f.periodo,
      vencimiento: fechaISO(f.vencimiento),
      total: toMonto(f.total),
      pagado: toMonto(pagado.greaterThan(0) ? pagado : f.total),
    });
  }

  const anios: GrupoAnioPagosCompletos[] = [...porAnio.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([anio, mapaAlumnos]) => {
      const alumnos: GrupoAlumnoPagosCompletos[] = [...mapaAlumnos.entries()]
        .map(([id, g]) => ({
          estudianteId: id,
          alumno: g.alumno,
          legajo: g.legajo,
          curso: g.curso,
          subtotal: toMonto(sumar(g.totales)),
          facturas: g.facturas,
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
    totalGeneral: toMonto(sumar(facturas.map((f) => f.total))),
    anios,
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: DatosPagosCompletos) {
  const subtitulo = [rangoLabel(data), data.alumnoFiltro ? `Alumno: ${data.alumnoFiltro}` : null]
    .filter(Boolean)
    .join(' · ');
  encabezadoReporte(doc, 'Reporte de Pagos Completos por Período', subtitulo);

  if (data.anios.length === 0) {
    seccion(doc, 'Sin pagos completos en el período');
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
          titulos: ['Factura', 'Período', 'Vencimiento', 'Total', 'Pagado'],
          anchos: [145, 90, 100, 90, 90],
          derecha: [3, 4],
        },
        al.facturas.map((f) => [
          f.facturaNumero,
          f.periodo,
          fechaCorta(f.vencimiento),
          formatearPesos(f.total),
          formatearPesos(f.pagado),
        ]),
      );
    }
  }

  doc.moveDown(0.8);
  bloqueTotales(doc, [['Total pagado', formatearPesos(data.totalGeneral), true]]);
}

function nombreArchivo(data: DatosPagosCompletos) {
  return `pagos-completos-${data.desde}-a-${data.hasta}.pdf`;
}

export const pagosCompletosPorPeriodoStrategy: ReportStrategy<ParamsPeriodoAlumno, DatosPagosCompletos> = {
  key: 'pagos-completos-por-periodo',
  titulo: 'Pagos Completos por Período',
  descripcion:
    'Facturas pagadas en su totalidad con vencimiento en el período, agrupadas por año y por alumno.',
  rolesAutorizados: [Role.ADMIN],
  parseParams: parseParamsPeriodoAlumno,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
