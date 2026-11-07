import type { Request } from 'express';
import { EstadoCuota } from '@prisma/client';

import { HttpError } from '../../utils/httpError';
import { esFechaValida, fechaISO, RANGO_MAXIMO_MESES, sumarMeses, type RangoFechas } from '../../utils/fechas';

// Helpers de parseo y formato compartidos por los 5 reportes financieros
// (RF-52 y RF-53, D10):
// - desde y hasta son obligatorios, en formato AAAA-MM-DD, con un rango
//   máximo de 24 meses;
// - los filtros de id opcionales (estudianteId, nivelId, deporteId,
//   docenteId, recorridoId) usan la misma semántica que RF-32 y RF-33.

export function parseIdOpcional(valor: unknown, nombre: string): number | null {
  if (valor === undefined || valor === null || valor === '') return null;
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw HttpError.badRequest(`El parámetro ${nombre} es inválido.`);
  }
  return n;
}

export function parseRangoObligatorio(req: Request): RangoFechas {
  const desde = typeof req.query.desde === 'string' ? req.query.desde.trim() : '';
  const hasta = typeof req.query.hasta === 'string' ? req.query.hasta.trim() : '';
  if (!desde || !hasta) {
    throw HttpError.badRequest('Los parámetros "desde" y "hasta" son obligatorios (formato AAAA-MM-DD).');
  }
  if (!esFechaValida(desde)) {
    throw HttpError.badRequest('La fecha "desde" es inválida. Usá el formato AAAA-MM-DD (ej. 2026-09-01).');
  }
  if (!esFechaValida(hasta)) {
    throw HttpError.badRequest('La fecha "hasta" es inválida. Usá el formato AAAA-MM-DD (ej. 2026-11-30).');
  }
  if (desde > hasta) {
    throw HttpError.badRequest('La fecha "desde" no puede ser posterior a "hasta".');
  }
  if (hasta > sumarMeses(desde, RANGO_MAXIMO_MESES)) {
    throw HttpError.badRequest(`El rango de fechas no puede superar los ${RANGO_MAXIMO_MESES} meses.`);
  }
  return { desde, hasta };
}

export interface ParamsPeriodoAlumno {
  desde: string;
  hasta: string;
  estudianteId: number | null;
}

export function parseParamsPeriodoAlumno(req: Request): ParamsPeriodoAlumno {
  const { desde, hasta } = parseRangoObligatorio(req);
  const estudianteId = parseIdOpcional(req.query.estudianteId, 'estudianteId');
  return { desde, hasta, estudianteId };
}

export const fechaCorta = (iso: string) => iso.split('-').reverse().join('/');

export const rangoLabel = (rango: RangoFechas) => `Período: ${fechaCorta(rango.desde)} al ${fechaCorta(rango.hasta)}`;

export const ESTADO_CUOTA_REPORTE_LABEL: Record<EstadoCuota | 'VENCIDA', string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  PAGADA: 'Pagada',
  VENCIDA: 'Vencida',
};

export function estadoCuotaLabel(estado: EstadoCuota, vencimiento: Date, hoy: string): string {
  const vista = estado === EstadoCuota.PENDIENTE && fechaISO(vencimiento) < hoy ? 'VENCIDA' : estado;
  return ESTADO_CUOTA_REPORTE_LABEL[vista];
}
