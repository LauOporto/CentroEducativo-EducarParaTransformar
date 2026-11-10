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

// Enunciado (Parte 3, listados 2 y 3): "discriminado por año y por año a que
// alumno corresponde". Se lee como dos cortes: el año del período facturado y
// el año escolar (curso) del alumno. Dentro de cada año se resume por curso y
// los alumnos se listan agrupados por curso.
export interface ResumenCurso {
  curso: string;
  alumnos: number;
  subtotal: number;
}

export const SIN_CURSO = 'Sin curso asignado';

export function resumenPorCurso<T extends { curso: string | null }>(
  alumnos: T[],
  monto: (a: T) => number,
): ResumenCurso[] {
  const mapa = new Map<string, ResumenCurso>();
  for (const a of alumnos) {
    const curso = a.curso ?? SIN_CURSO;
    const r = mapa.get(curso) ?? { curso, alumnos: 0, subtotal: 0 };
    r.alumnos += 1;
    r.subtotal = Math.round((r.subtotal + monto(a)) * 100) / 100;
    mapa.set(curso, r);
  }
  return [...mapa.values()].sort((a, b) => a.curso.localeCompare(b.curso, 'es', { numeric: true }));
}

export const porCursoYAlumno = (
  a: { curso: string | null; alumno: string },
  b: { curso: string | null; alumno: string },
) =>
  (a.curso ?? SIN_CURSO).localeCompare(b.curso ?? SIN_CURSO, 'es', { numeric: true }) ||
  a.alumno.localeCompare(b.alumno);

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
