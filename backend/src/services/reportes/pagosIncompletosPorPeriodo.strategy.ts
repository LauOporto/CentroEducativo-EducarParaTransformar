import { EstadoFactura, Prisma, Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { CURSO_SELECT, formatCursoLabel } from '../../utils/cursoLabel';
import { fechaISO, fechaUTC } from '../../utils/fechas';
import { HttpError } from '../../utils/httpError';
import { formatearPesos, sumar, toMonto } from '../../utils/montos';
import { bloqueTotales, tablaItems } from '../facturaPdf.service';
import { fechaCorta, parseParamsPeriodoAlumno, rangoLabel, type ParamsPeriodoAlumno } from './financieros.helpers';
import { encabezadoReporte, seccion } from './pdfHelpers';
import type { ReportStrategy } from './types';

// RF-52 (D10, Listado 3): "Pagos incompletos por período de tiempo, por año y
// por alumno".
// Fuente: facturas en estado PENDIENTE o PARCIAL con vencimiento en el rango
// [desde, hasta] y saldo pendiente > 0, agrupadas por año del período y por
// alumno, detallando total, pagado y saldo.

const ESTADO_FACTURA_LABEL: Record<EstadoFactura, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Parcial',
  PAGADA: 'Pagada',
};

export interface FilaPagoIncompleto {
  facturaNumero: string;
  periodo: string;
  vencimiento: string;
  estado: string;
  total: number;
  pagado: number;
  saldo: number;
}

export interface GrupoAlumnoPagosIncompletos {
  estudianteId: number;
  alumno: string;
  legajo: string | null;
  curso: string | null;
  subtotalTotal: number;
  subtotalPagado: number;
  subtotalSaldo: number;
  facturas: FilaPagoIncompleto[];
}

export interface GrupoAnioPagosIncompletos {
  anio: string;
  subtotalTotal: number;
  subtotalPagado: number;
  subtotalSaldo: number;
  alumnos: GrupoAlumnoPagosIncompletos[];
}

export interface DatosPagosIncompletos {
  desde: string;
  hasta: string;
  alumnoFiltro: string | null;
  totalFacturado: number;
  totalPagado: number;
  totalSaldo: number;
  anios: GrupoAnioPagosIncompletos[];
}

async function obtenerDatos({ desde, hasta, estudianteId }: ParamsPeriodoAlumno): Promise<DatosPagosIncompletos> {
  const alumnoRow = estudianteId
    ? await prisma.user.findFirst({
        where: { id: estudianteId, role: Role.ESTUDIANTE },
        select: { id: true, nombre: true },
      })
    : null;
  if (estudianteId && !alumnoRow) throw HttpError.notFound('El alumno indicado no existe.');

  const facturas = await prisma.factura.findMany({
    where: {
      estado: { in: [EstadoFactura.PENDIENTE, EstadoFactura.PARCIAL] },
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
        totales: Prisma.Decimal[];
        pagados: Prisma.Decimal[];
        saldos: Prisma.Decimal[];
        facturas: FilaPagoIncompleto[];
      }
    >
  >();

  const totalesGlobal: Prisma.Decimal[] = [];
  const pagadosGlobal: Prisma.Decimal[] = [];
  const saldosGlobal: Prisma.Decimal[] = [];

  for (const f of facturas) {
    const total = new Prisma.Decimal(f.total);
    const pagado = sumar(f.pagos.map((p) => p.monto));
    const saldo = total.minus(pagado);
    if (!saldo.greaterThan(0)) continue;

    totalesGlobal.push(total);
    pagadosGlobal.push(pagado);
    saldosGlobal.push(saldo);

    const anio = f.periodo.slice(0, 4);
    if (!porAnio.has(anio)) porAnio.set(anio, new Map());
    const mapaAlumnos = porAnio.get(anio)!;
    if (!mapaAlumnos.has(f.estudianteId)) {
      mapaAlumnos.set(f.estudianteId, {
        alumno: f.estudiante.nombre,
        legajo: f.estudiante.legajo,
        curso: formatCursoLabel(f.estudiante.curso),
        totales: [],
        pagados: [],
        saldos: [],
        facturas: [],
      });
    }
    const entry = mapaAlumnos.get(f.estudianteId)!;
    entry.totales.push(total);
    entry.pagados.push(pagado);
    entry.saldos.push(saldo);
    entry.facturas.push({
      facturaNumero: f.numero,
      periodo: f.periodo,
      vencimiento: fechaISO(f.vencimiento),
      estado: ESTADO_FACTURA_LABEL[f.estado] ?? f.estado,
      total: toMonto(total),
      pagado: toMonto(pagado),
      saldo: toMonto(saldo),
    });
  }

  const anios: GrupoAnioPagosIncompletos[] = [...porAnio.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([anio, mapaAlumnos]) => {
      const alumnos: GrupoAlumnoPagosIncompletos[] = [...mapaAlumnos.entries()]
        .map(([id, g]) => ({
          estudianteId: id,
          alumno: g.alumno,
          legajo: g.legajo,
          curso: g.curso,
          subtotalTotal: toMonto(sumar(g.totales)),
          subtotalPagado: toMonto(sumar(g.pagados)),
          subtotalSaldo: toMonto(sumar(g.saldos)),
          facturas: g.facturas,
        }))
        .sort((a, b) => a.alumno.localeCompare(b.alumno));
      return {
        anio,
        subtotalTotal: toMonto(sumar(alumnos.map((a) => a.subtotalTotal))),
        subtotalPagado: toMonto(sumar(alumnos.map((a) => a.subtotalPagado))),
        subtotalSaldo: toMonto(sumar(alumnos.map((a) => a.subtotalSaldo))),
        alumnos,
      };
    });

  return {
    desde,
    hasta,
    alumnoFiltro: alumnoRow?.nombre ?? null,
    totalFacturado: toMonto(sumar(totalesGlobal)),
    totalPagado: toMonto(sumar(pagadosGlobal)),
    totalSaldo: toMonto(sumar(saldosGlobal)),
    anios,
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: DatosPagosIncompletos) {
  const subtitulo = [rangoLabel(data), data.alumnoFiltro ? `Alumno: ${data.alumnoFiltro}` : null]
    .filter(Boolean)
    .join(' · ');
  encabezadoReporte(doc, 'Reporte de Pagos Incompletos por Período', subtitulo);

  if (data.anios.length === 0) {
    seccion(doc, 'Sin pagos incompletos en el período');
    return;
  }

  for (const grupoAnio of data.anios) {
    seccion(doc, `Año ${grupoAnio.anio} — Saldo pendiente: ${formatearPesos(grupoAnio.subtotalSaldo)}`);
    for (const al of grupoAnio.alumnos) {
      doc.moveDown(0.3);
      doc
        .font('Helvetica-Bold')
        .fontSize(10)
        .text(
          `${al.alumno}${al.legajo ? ` (${al.legajo})` : ''}${al.curso ? ` — ${al.curso}` : ''} · Saldo: ${formatearPesos(al.subtotalSaldo)}`,
        );
      doc.moveDown(0.2);
      tablaItems(
        doc,
        {
          titulos: ['Factura', 'Período', 'Vencimiento', 'Estado', 'Total', 'Pagado', 'Saldo'],
          anchos: [110, 60, 75, 60, 70, 70, 70],
          derecha: [4, 5, 6],
        },
        al.facturas.map((f) => [
          f.facturaNumero,
          f.periodo,
          fechaCorta(f.vencimiento),
          f.estado,
          formatearPesos(f.total),
          formatearPesos(f.pagado),
          formatearPesos(f.saldo),
        ]),
      );
    }
  }

  doc.moveDown(0.8);
  bloqueTotales(doc, [
    ['Total facturado', formatearPesos(data.totalFacturado), false],
    ['Total pagado', formatearPesos(data.totalPagado), false],
    ['Saldo pendiente', formatearPesos(data.totalSaldo), true],
  ]);
}

function nombreArchivo(data: DatosPagosIncompletos) {
  return `pagos-incompletos-${data.desde}-a-${data.hasta}.pdf`;
}

export const pagosIncompletosPorPeriodoStrategy: ReportStrategy<ParamsPeriodoAlumno, DatosPagosIncompletos> = {
  key: 'pagos-incompletos-por-periodo',
  titulo: 'Pagos Incompletos por Período',
  descripcion:
    'Facturas pendientes o con pago parcial y saldo mayor a 0 en el período, agrupadas por año y por alumno, con total, pagado y saldo.',
  rolesAutorizados: [Role.ADMIN],
  parseParams: parseParamsPeriodoAlumno,
  obtenerDatos,
  renderPdf,
  nombreArchivo,
};
