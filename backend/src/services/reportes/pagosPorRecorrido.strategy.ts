import type { Request } from 'express';
import { ConceptoCuota, EstadoComprobante, Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { CURSO_SELECT } from '../../utils/cursoLabel';
import { fechaUTC, hoyArgentina, ZONA_NEGOCIO } from '../../utils/fechas';
import { HttpError } from '../../utils/httpError';
import { formatearPesos, sumar, toMonto } from '../../utils/montos';
import { bloqueTotales, tablaItems } from '../facturaPdf.service';
import {
  estadoCuotaLabel,
  fechaCorta,
  parseIdOpcional,
  parseRangoObligatorio,
  rangoLabel,
} from './financieros.helpers';
import { encabezadoReporte, horaLabel, seccion } from './pdfHelpers';
import type { ReportStrategy } from './types';

// RF-53 (D10, Listado 5): "Pagos por recorrido de transporte".
// Reutiliza el parámetro recorridoId de RF-33 más estudianteId opcional y el
// rango de fechas desde/hasta obligatorio.

export interface ParamsPagosPorRecorrido {
  desde: string;
  hasta: string;
  recorridoId: number | null;
  estudianteId: number | null;
}

export interface FilaPagoRecorrido {
  recorrido: string;
  horario: string;
  alumno: string;
  curso: string;
  periodo: string;
  importe: number;
  estado: string;
  fechaPago: string | null;
}

export interface DatosPagosPorRecorrido {
  desde: string;
  hasta: string;
  recorridoFiltro: string | null;
  alumnoFiltro: string | null;
  totalFacturado: number;
  totalCobrado: number;
  filas: FilaPagoRecorrido[];
}

export function parseParamsPagosPorRecorrido(req: Request): ParamsPagosPorRecorrido {
  const { desde, hasta } = parseRangoObligatorio(req);
  return {
    desde,
    hasta,
    recorridoId: parseIdOpcional(req.query.recorridoId, 'recorridoId'),
    estudianteId: parseIdOpcional(req.query.estudianteId, 'estudianteId'),
  };
}

function fechaArgentinaISO(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

async function obtenerDatos(
  params: ParamsPagosPorRecorrido,
  opts: { hoy?: string } = {},
): Promise<DatosPagosPorRecorrido> {
  const { desde, hasta, recorridoId, estudianteId } = params;
  const hoy = opts.hoy ?? hoyArgentina();

  const [recorridoFiltroRow, alumno] = await Promise.all([
    recorridoId ? prisma.recorridoTransporte.findUnique({ where: { id: recorridoId } }) : null,
    estudianteId
      ? prisma.user.findFirst({
          where: { id: estudianteId, role: Role.ESTUDIANTE },
          select: { id: true, nombre: true },
        })
      : null,
  ]);
  if (recorridoId && !recorridoFiltroRow) throw HttpError.notFound('El recorrido indicado no existe.');
  if (estudianteId && !alumno) throw HttpError.notFound('El alumno indicado no existe.');

  const cuotas = await prisma.cuota.findMany({
    where: {
      concepto: ConceptoCuota.TRANSPORTE,
      ...(recorridoId ? { referenciaId: recorridoId } : {}),
      ...(estudianteId ? { estudianteId } : {}),
      vencimiento: { gte: fechaUTC(desde), lte: fechaUTC(hasta) },
    },
    include: {
      factura: { select: { periodo: true } },
      estudiante: { select: { nombre: true, curso: { select: CURSO_SELECT } } },
      itemsComprobante: {
        where: { comprobante: { estado: EstadoComprobante.APROBADO } },
        include: { comprobante: { select: { pago: { select: { fechaAcreditacion: true } } } } },
      },
    },
    orderBy: [{ factura: { periodo: 'asc' } }, { id: 'asc' }],
  });

  const recorridoIds = [...new Set(cuotas.map((c) => c.referenciaId))];
  const recorridos = recorridoIds.length
    ? await prisma.recorridoTransporte.findMany({
        where: { id: { in: recorridoIds } },
      })
    : [];
  const recorridoPorId = new Map(recorridos.map((r) => [r.id, r]));

  const filas: FilaPagoRecorrido[] = [];
  const importesFacturados: (typeof cuotas)[number]['importe'][] = [];
  const importesCobrados: (typeof cuotas)[number]['importe'][] = [];

  for (const c of cuotas) {
    const r = recorridoPorId.get(c.referenciaId);
    const nombreRecorrido = r?.nombre ?? c.descripcion;
    const horario = r ? `Salida ${horaLabel(r.horaSalida)} · Regreso ${horaLabel(r.horaRegreso)}` : '—';
    const fechaAcred = c.itemsComprobante[0]?.comprobante.pago?.fechaAcreditacion ?? null;
    const fechaPago = fechaAcred ? fechaArgentinaISO(fechaAcred) : null;

    importesFacturados.push(c.importe);
    if (c.estado === 'PAGADA') importesCobrados.push(c.importe);

    filas.push({
      recorrido: nombreRecorrido,
      horario,
      alumno: c.estudiante.nombre,
      curso: c.estudiante.curso?.nombre ?? '—',
      periodo: c.factura.periodo,
      importe: toMonto(c.importe),
      estado: estadoCuotaLabel(c.estado, c.vencimiento, hoy),
      fechaPago,
    });
  }

  filas.sort(
    (a, b) =>
      a.recorrido.localeCompare(b.recorrido) ||
      a.alumno.localeCompare(b.alumno) ||
      a.periodo.localeCompare(b.periodo),
  );

  return {
    desde,
    hasta,
    recorridoFiltro: recorridoFiltroRow?.nombre ?? null,
    alumnoFiltro: alumno?.nombre ?? null,
    totalFacturado: toMonto(sumar(importesFacturados)),
    totalCobrado: toMonto(sumar(importesCobrados)),
    filas,
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: DatosPagosPorRecorrido) {
  const filtros = [
    rangoLabel(data),
    data.recorridoFiltro ? `Recorrido: ${data.recorridoFiltro}` : null,
    data.alumnoFiltro ? `Alumno: ${data.alumnoFiltro}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  encabezadoReporte(doc, 'Reporte de Pagos por Recorrido de Transporte', filtros);

  if (data.filas.length === 0) {
    seccion(doc, 'Sin registros en el período para los filtros seleccionados');
    return;
  }

  tablaItems(
    doc,
    {
      titulos: ['Recorrido', 'Horario', 'Alumno', 'Curso', 'Período', 'Importe', 'Estado', 'Fecha pago'],
      anchos: [75, 90, 85, 55, 50, 60, 50, 50],
      derecha: [5],
    },
    data.filas.map((f) => [
      f.recorrido,
      f.horario,
      f.alumno,
      f.curso,
      f.periodo,
      formatearPesos(f.importe),
      f.estado,
      f.fechaPago ? fechaCorta(f.fechaPago) : '—',
    ]),
  );

  doc.moveDown(0.8);
  bloqueTotales(doc, [
    ['Total facturado', formatearPesos(data.totalFacturado), false],
    ['Total cobrado', formatearPesos(data.totalCobrado), true],
  ]);
}

function nombreArchivo(data: DatosPagosPorRecorrido) {
  return `pagos-por-recorrido-${data.desde}-a-${data.hasta}.pdf`;
}

export const pagosPorRecorridoStrategy: ReportStrategy<ParamsPagosPorRecorrido, DatosPagosPorRecorrido> = {
  key: 'pagos-por-recorrido',
  titulo: 'Pagos por Recorrido de Transporte',
  descripcion:
    'Ítems de transporte facturados en el período con recorrido, horario, alumno, curso, importe, estado y fecha de pago.',
  rolesAutorizados: [Role.ADMIN],
  parseParams: parseParamsPagosPorRecorrido,
  obtenerDatos: (params) => obtenerDatos(params),
  renderPdf,
  nombreArchivo,
};
