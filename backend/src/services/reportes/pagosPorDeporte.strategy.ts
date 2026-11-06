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
import { DIA_LABEL, encabezadoReporte, horaLabel, seccion } from './pdfHelpers';
import type { ReportStrategy } from './types';

// RF-53 (D10, Listado 4): "Pagos por alumno por deporte, nivel educativo,
// horario y profesor a cargo".
// Reutiliza los parámetros de RF-32 (nivelId, deporteId) más docenteId y
// estudianteId opcionales, y el rango de fechas desde/hasta obligatorio.
// Columnas (D10): deporte, nivel, día y horario, profesor, alumno, curso,
// período, importe, estado y fecha de pago.

export interface ParamsPagosPorDeporte {
  desde: string;
  hasta: string;
  nivelId: number | null;
  deporteId: number | null;
  docenteId: number | null;
  estudianteId: number | null;
}

export interface FilaPagoDeporte {
  deporte: string;
  nivel: string;
  diaHorario: string;
  profesor: string;
  alumno: string;
  curso: string;
  periodo: string;
  importe: number;
  estado: string;
  fechaPago: string | null; // "AAAA-MM-DD" o null si no está pagada
}

export interface DatosPagosPorDeporte {
  desde: string;
  hasta: string;
  nivelFiltro: string | null;
  deporteFiltro: string | null;
  docenteFiltro: string | null;
  alumnoFiltro: string | null;
  totalFacturado: number;
  totalCobrado: number;
  filas: FilaPagoDeporte[];
}

export function parseParamsPagosPorDeporte(req: Request): ParamsPagosPorDeporte {
  const { desde, hasta } = parseRangoObligatorio(req);
  return {
    desde,
    hasta,
    nivelId: parseIdOpcional(req.query.nivelId, 'nivelId'),
    deporteId: parseIdOpcional(req.query.deporteId, 'deporteId'),
    docenteId: parseIdOpcional(req.query.docenteId, 'docenteId'),
    estudianteId: parseIdOpcional(req.query.estudianteId, 'estudianteId'),
  };
}

function parseSnapshotDeporte(descripcion: string) {
  const partes = descripcion.split(' — ').map((s) => s.trim());
  const deporte = partes[0] ?? descripcion;
  const nivel = partes[1] ?? '—';
  const diaHorario = partes[2] ?? '—';
  const profesorRaw = partes[3] ?? '—';
  const profesor = profesorRaw.replace(/^Prof\.\s*/i, '');
  return { deporte, nivel, diaHorario, profesor };
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
  params: ParamsPagosPorDeporte,
  opts: { hoy?: string } = {},
): Promise<DatosPagosPorDeporte> {
  const { desde, hasta, nivelId, deporteId, docenteId, estudianteId } = params;
  const hoy = opts.hoy ?? hoyArgentina();

  const [nivel, deporte, docente, alumno] = await Promise.all([
    nivelId ? prisma.nivelEducativo.findUnique({ where: { id: nivelId } }) : null,
    deporteId ? prisma.deporte.findUnique({ where: { id: deporteId } }) : null,
    docenteId
      ? prisma.user.findFirst({ where: { id: docenteId, role: Role.DOCENTE }, select: { id: true, nombre: true } })
      : null,
    estudianteId
      ? prisma.user.findFirst({
          where: { id: estudianteId, role: Role.ESTUDIANTE },
          select: { id: true, nombre: true },
        })
      : null,
  ]);
  if (nivelId && !nivel) throw HttpError.notFound('El nivel indicado no existe.');
  if (deporteId && !deporte) throw HttpError.notFound('El deporte indicado no existe.');
  if (docenteId && !docente) throw HttpError.notFound('El profesor indicado no existe.');
  if (estudianteId && !alumno) throw HttpError.notFound('El alumno indicado no existe.');

  const cuotas = await prisma.cuota.findMany({
    where: {
      concepto: ConceptoCuota.DEPORTE,
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

  const grupoIds = [...new Set(cuotas.map((c) => c.referenciaId))];
  const grupos = grupoIds.length
    ? await prisma.grupoDeporte.findMany({
        where: { id: { in: grupoIds } },
        include: {
          deporte: true,
          nivel: true,
          docente: { select: { id: true, nombre: true } },
        },
      })
    : [];
  const grupoPorId = new Map(grupos.map((g) => [g.id, g]));

  const filas: FilaPagoDeporte[] = [];
  const importesFacturados: (typeof cuotas)[number]['importe'][] = [];
  const importesCobrados: (typeof cuotas)[number]['importe'][] = [];

  for (const c of cuotas) {
    const g = grupoPorId.get(c.referenciaId);
    const snap = parseSnapshotDeporte(c.descripcion);

    if (deporteId && (g ? g.deporteId !== deporteId : snap.deporte !== deporte?.nombre)) continue;
    if (nivelId && (g ? g.nivelId !== nivelId : snap.nivel !== nivel?.nombre)) continue;
    if (docenteId && (g ? g.docenteId !== docenteId : snap.profesor !== docente?.nombre)) continue;

    const deporteNombre = g?.deporte.nombre ?? snap.deporte;
    const nivelNombre = g?.nivel.nombre ?? snap.nivel;
    const diaHorario = g
      ? `${DIA_LABEL[g.diaSemana] ?? g.diaSemana} ${horaLabel(g.horaInicio)} a ${horaLabel(g.horaFin)}`
      : snap.diaHorario;
    const profesorNombre = g?.docente.nombre ?? snap.profesor;

    const fechaAcred = c.itemsComprobante[0]?.comprobante.pago?.fechaAcreditacion ?? null;
    const fechaPago = fechaAcred ? fechaArgentinaISO(fechaAcred) : null;

    importesFacturados.push(c.importe);
    if (c.estado === 'PAGADA') importesCobrados.push(c.importe);

    filas.push({
      deporte: deporteNombre,
      nivel: nivelNombre,
      diaHorario,
      profesor: profesorNombre,
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
      a.deporte.localeCompare(b.deporte) ||
      a.nivel.localeCompare(b.nivel) ||
      a.alumno.localeCompare(b.alumno) ||
      a.periodo.localeCompare(b.periodo),
  );

  return {
    desde,
    hasta,
    nivelFiltro: nivel?.nombre ?? null,
    deporteFiltro: deporte?.nombre ?? null,
    docenteFiltro: docente?.nombre ?? null,
    alumnoFiltro: alumno?.nombre ?? null,
    totalFacturado: toMonto(sumar(importesFacturados)),
    totalCobrado: toMonto(sumar(importesCobrados)),
    filas,
  };
}

function renderPdf(doc: PDFKit.PDFDocument, data: DatosPagosPorDeporte) {
  const filtros = [
    rangoLabel(data),
    data.deporteFiltro ? `Deporte: ${data.deporteFiltro}` : null,
    data.nivelFiltro ? `Nivel: ${data.nivelFiltro}` : null,
    data.docenteFiltro ? `Profesor: ${data.docenteFiltro}` : null,
    data.alumnoFiltro ? `Alumno: ${data.alumnoFiltro}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  encabezadoReporte(doc, 'Reporte de Pagos por Deporte, Nivel, Horario y Profesor', filtros);

  if (data.filas.length === 0) {
    seccion(doc, 'Sin registros en el período para los filtros seleccionados');
    return;
  }

  tablaItems(
    doc,
    {
      titulos: [
        'Deporte',
        'Nivel',
        'Día y horario',
        'Profesor',
        'Alumno',
        'Curso',
        'Período',
        'Importe',
        'Estado',
        'Fecha pago',
      ],
      anchos: [48, 44, 66, 62, 68, 42, 42, 53, 45, 45],
      derecha: [7],
    },
    data.filas.map((f) => [
      f.deporte,
      f.nivel,
      f.diaHorario,
      f.profesor,
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

function nombreArchivo(data: DatosPagosPorDeporte) {
  return `pagos-por-deporte-${data.desde}-a-${data.hasta}.pdf`;
}

export const pagosPorDeporteStrategy: ReportStrategy<ParamsPagosPorDeporte, DatosPagosPorDeporte> = {
  key: 'pagos-por-deporte',
  titulo: 'Pagos por Deporte, Nivel, Horario y Profesor',
  descripcion:
    'Ítems de deportes facturados en el período con día, horario, profesor, alumno, curso, importe, estado y fecha de pago.',
  rolesAutorizados: [Role.ADMIN],
  parseParams: parseParamsPagosPorDeporte,
  obtenerDatos: (params) => obtenerDatos(params),
  renderPdf,
  nombreArchivo,
};
