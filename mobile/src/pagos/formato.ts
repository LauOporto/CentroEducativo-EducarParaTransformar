import type { Concepto, EstadoComprobante, EstadoFactura, EstadoItem } from './tipos';

// Formatos de montos, fechas y estados para las pantallas de pagos.
// Sin Intl ni new Date() sobre fechas de negocio: Hermes en Android puede no
// traer los datos de locale de es-AR, y "2026-11-10" interpretado como fecha
// en la zona de Argentina (UTC-3) cae el 09/11 a las 21:00.

const NBSP = ' ';

/** Miles con punto, sin regex: "1234567" → "1.234.567". */
function conMiles(entero: string): string {
  let salida = '';
  for (let i = 0; i < entero.length; i++) {
    if (i > 0 && (entero.length - i) % 3 === 0) salida += '.';
    salida += entero[i];
  }
  return salida;
}

/**
 * "$ 292.000,00": el mismo formato que formatearPesos del backend
 * (Intl es-AR con ARS, separado por un espacio no separable).
 */
export function pesos(n: number): string {
  const centavos = Math.round(Math.abs(n) * 100);
  const entero = String(Math.floor(centavos / 100));
  const decimales = String(centavos % 100).padStart(2, '0');
  const signo = n < 0 && centavos > 0 ? '-' : '';
  return `${signo}$${NBSP}${conMiles(entero)},${decimales}`;
}

/** "2026-11-10" o "2026-11-10T00:00:00.000Z" → "10/11/2026", cortando el texto. */
export function fechaCorta(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

const OFFSET_ARGENTINA_MS = 3 * 60 * 60 * 1000; // UTC-3 fijo: sin horario de verano desde 2009

/** Día "AAAA-MM-DD" en Argentina de un instante ISO (ej. fechaAcreditacion). */
export function diaArgentina(instante: string | number): string {
  const ms = typeof instante === 'number' ? instante : Date.parse(instante);
  return new Date(ms - OFFSET_ARGENTINA_MS).toISOString().slice(0, 10);
}

/** Hoy en Argentina, "AAAA-MM-DD" (igual que hoyArgentina del backend). */
export const hoyArgentina = (ahora: number = Date.now()) => diaArgentina(ahora);

/** Instante ISO → "07/10/2026" en el día de Argentina. */
export const fechaDeInstante = (instante: string) => fechaCorta(diaArgentina(instante));

export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

/** "2026-11" → "Noviembre 2026". */
export function periodoLargo(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  return `${MESES[Number(mes) - 1] ?? mes} ${anio}`;
}

/** "2026-11" → "Nov 2026" (chips del filtro). */
export function periodoCorto(periodo: string): string {
  const [anio, mes] = periodo.split('-');
  return `${(MESES[Number(mes) - 1] ?? String(mes)).slice(0, 3)} ${anio}`;
}

export const ETIQUETA_CONCEPTO: Record<Concepto, string> = {
  CUOTA: 'Cuota',
  DEPORTE: 'Deporte',
  TRANSPORTE: 'Transporte',
  COMEDOR: 'Comedor',
};

export const CONCEPTOS: Concepto[] = ['CUOTA', 'DEPORTE', 'TRANSPORTE', 'COMEDOR'];

export const ETIQUETA_ESTADO_ITEM: Record<EstadoItem, string> = {
  PENDIENTE: 'Pendiente',
  VENCIDA: 'Vencida',
  EN_REVISION: 'En revisión',
  PAGADA: 'Pagada',
};

export const ETIQUETA_ESTADO_FACTURA: Record<EstadoFactura, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Pago parcial',
  PAGADA: 'Pagada',
};

export const ETIQUETA_ESTADO_COMPROBANTE: Record<EstadoComprobante, string> = {
  GENERADO: 'Generado',
  EN_REVISION: 'En revisión',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
};
