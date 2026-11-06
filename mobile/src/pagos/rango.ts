import { periodoLargo } from './formato';

// Filtro por rango de fechas del estado de cuenta (RF-49). Las facturas son
// mensuales, así que se elige por meses: "desde" es el día 1 del mes inicial
// y "hasta" el último día del mes final. Mismas reglas que parseRangoFechas
// del backend: desde ≤ hasta y como máximo 24 meses.

/** "AAAA-MM" */
export type Mes = string;

export const RANGO_MAXIMO_MESES = 24;

export type Preset = 'ultimos6' | 'esteAnio' | 'anioAnterior' | 'personalizado';

export type Filtro = { preset: Exclude<Preset, 'personalizado'> } | { preset: 'personalizado'; desde: Mes; hasta: Mes };

export const PRESETS: { valor: Preset; etiqueta: string }[] = [
  { valor: 'ultimos6', etiqueta: 'Últimos 6 meses' },
  { valor: 'esteAnio', etiqueta: 'Este año' },
  { valor: 'anioAnterior', etiqueta: 'Año anterior' },
  { valor: 'personalizado', etiqueta: 'Personalizado' },
];

export const FILTRO_INICIAL: Filtro = { preset: 'ultimos6' };

export type Rango = { desde: string; hasta: string };

function partes(mes: Mes): [number, number] {
  const [anio, m] = mes.split('-').map(Number);
  return [anio ?? 0, m ?? 1];
}

export function sumarMeses(mes: Mes, n: number): Mes {
  const [anio, m] = partes(mes);
  const total = anio * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Meses entre dos meses, contando los dos extremos. */
export function mesesEntre(desde: Mes, hasta: Mes): number {
  const [a1, m1] = partes(desde);
  const [a2, m2] = partes(hasta);
  return a2 * 12 + m2 - (a1 * 12 + m1) + 1;
}

export const primerDia = (mes: Mes) => `${mes}-01`;

export function ultimoDia(mes: Mes): string {
  const [anio, m] = partes(mes);
  const dias = new Date(Date.UTC(anio, m, 0)).getUTCDate();
  return `${mes}-${String(dias).padStart(2, '0')}`;
}

/** Meses del preset, a partir de "hoy" (AAAA-MM-DD, en Argentina). */
export function mesesDelFiltro(filtro: Filtro, hoy: string): { desde: Mes; hasta: Mes } {
  const actual = hoy.slice(0, 7);
  const anio = Number(hoy.slice(0, 4));
  switch (filtro.preset) {
    // Igual al default del backend: de hoy − 6 meses a hoy + 2 meses, así
    // entra la factura emitida que todavía no venció.
    case 'ultimos6':
      return { desde: sumarMeses(actual, -6), hasta: sumarMeses(actual, 2) };
    case 'esteAnio':
      return { desde: `${anio}-01`, hasta: `${anio}-12` };
    case 'anioAnterior':
      return { desde: `${anio - 1}-01`, hasta: `${anio - 1}-12` };
    case 'personalizado':
      return { desde: filtro.desde, hasta: filtro.hasta };
  }
}

export function validarMeses(desde: Mes, hasta: Mes): string | null {
  if (desde > hasta) return 'El mes "Desde" no puede ser posterior a "Hasta".';
  if (mesesEntre(desde, hasta) > RANGO_MAXIMO_MESES) {
    return `El rango no puede superar los ${RANGO_MAXIMO_MESES} meses.`;
  }
  return null;
}

/** Rango para la API (AAAA-MM-DD), o el error si el personalizado no es válido. */
export function rangoDelFiltro(filtro: Filtro, hoy: string): { rango: Rango } | { error: string } {
  const { desde, hasta } = mesesDelFiltro(filtro, hoy);
  const error = validarMeses(desde, hasta);
  if (error) return { error };
  return { rango: { desde: primerDia(desde), hasta: ultimoDia(hasta) } };
}

/** Opciones del personalizado: los últimos 24 meses y los 2 siguientes, del más nuevo al más viejo. */
export function mesesElegibles(hoy: string): Mes[] {
  const actual = hoy.slice(0, 7);
  const meses: Mes[] = [];
  for (let n = 2; n > -RANGO_MAXIMO_MESES; n--) meses.push(sumarMeses(actual, n));
  return meses;
}

export function descripcionRango(filtro: Filtro, hoy: string): string {
  const { desde, hasta } = mesesDelFiltro(filtro, hoy);
  return `${periodoLargo(desde)} a ${periodoLargo(hasta)}`;
}
