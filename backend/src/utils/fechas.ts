import { HttpError } from './httpError';

// Fechas de negocio de la Parte 3, en la zona del colegio. Argentina no
// tiene horario de verano desde 2009: el offset es fijo (-03:00).
export const ZONA_NEGOCIO = 'America/Argentina/Buenos_Aires';
const OFFSET_ARGENTINA = '-03:00';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERIODO_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;
export const RANGO_MAXIMO_MESES = 24;

// "AAAA-MM-DD" del día actual en Argentina (no el de UTC: a las 22:00 de
// Argentina ya es el día siguiente en UTC).
export function hoyArgentina(ahora: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_NEGOCIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(ahora);
}

export function esPeriodoValido(periodo: string): boolean {
  return PERIODO_RE.test(periodo);
}

export function validarPeriodo(periodo: string): string {
  if (!esPeriodoValido(periodo)) {
    throw HttpError.badRequest(`El período "${periodo}" es inválido. Usá el formato AAAA-MM (ej. 2026-11).`);
  }
  return periodo;
}

function partesPeriodo(periodo: string) {
  const [anio, mes] = validarPeriodo(periodo).split('-').map(Number);
  return { anio, mes };
}

// Día 10 del período, como Date UTC a medianoche (así lo guarda @db.Date).
export function vencimientoDePeriodo(periodo: string): Date {
  const { anio, mes } = partesPeriodo(periodo);
  return new Date(Date.UTC(anio, mes - 1, 10));
}

export function sumarMesesPeriodo(periodo: string, meses: number): string {
  const { anio, mes } = partesPeriodo(periodo);
  const d = new Date(Date.UTC(anio, mes - 1 + meses, 1));
  return d.toISOString().slice(0, 7);
}

export const periodoSiguiente = (periodo: string) => sumarMesesPeriodo(periodo, 1);

export const periodoDeFecha = (fecha: string) => fecha.slice(0, 7);

export function esFechaValida(fecha: string): boolean {
  if (!FECHA_RE.test(fecha)) return false;
  const d = new Date(`${fecha}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === fecha;
}

// Suma meses a "AAAA-MM-DD"; si el día no existe en el mes de llegada, se
// usa el último (31/08 + 6 meses = 28/02 o 29/02).
export function sumarMeses(fecha: string, meses: number): string {
  const [anio, mes, dia] = fecha.split('-').map(Number);
  const ultimoDia = new Date(Date.UTC(anio, mes - 1 + meses + 1, 0)).getUTCDate();
  return new Date(Date.UTC(anio, mes - 1 + meses, Math.min(dia, ultimoDia))).toISOString().slice(0, 10);
}

export function diaSiguiente(fecha: string): string {
  const d = new Date(`${fecha}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

// "AAAA-MM-DD" → Date UTC a medianoche, para comparar con columnas @db.Date.
export const fechaUTC = (fecha: string) => new Date(`${fecha}T00:00:00.000Z`);

// Comienzo del día en Argentina, para comparar con columnas DateTime
// (ej. Pago.fechaAcreditacion).
export const inicioDiaArgentina = (fecha: string) => new Date(`${fecha}T00:00:00.000${OFFSET_ARGENTINA}`);

// Fecha @db.Date (Date UTC) → "AAAA-MM-DD".
export const fechaISO = (d: Date) => d.toISOString().slice(0, 10);

export interface RangoFechas {
  desde: string; // "AAAA-MM-DD", inclusive
  hasta: string; // "AAAA-MM-DD", inclusive
}

// Filtro desde/hasta del estado de cuenta (RF-49). Default: desde hoy − 6
// meses hasta hoy + 2 meses, para que entre la factura ya emitida que todavía
// no venció. Máximo 24 meses entre una fecha y otra.
export function parseRangoFechas(desde?: string, hasta?: string, hoy: string = hoyArgentina()): RangoFechas {
  const d = desde?.trim() || sumarMeses(hoy, -6);
  const h = hasta?.trim() || sumarMeses(hoy, 2);
  for (const [nombre, valor] of [
    ['desde', d],
    ['hasta', h],
  ] as const) {
    if (!esFechaValida(valor)) {
      throw HttpError.badRequest(`La fecha "${nombre}" es inválida. Usá el formato AAAA-MM-DD (ej. 2026-10-01).`);
    }
  }
  if (d > h) throw HttpError.badRequest('La fecha "desde" no puede ser posterior a "hasta".');
  if (h > sumarMeses(d, RANGO_MAXIMO_MESES)) {
    throw HttpError.badRequest(`El rango de fechas no puede superar los ${RANGO_MAXIMO_MESES} meses.`);
  }
  return { desde: d, hasta: h };
}
