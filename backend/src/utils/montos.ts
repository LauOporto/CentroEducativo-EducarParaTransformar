import { Prisma } from '@prisma/client';

// Montos de la Parte 3: Decimal(12,2) en la base y Prisma.Decimal en toda
// cuenta. Nunca aritmética con float (0.1 + 0.2 !== 0.3). En el JSON se
// exponen como number con 2 decimales, ya redondeados.
export type MontoEntrada = Prisma.Decimal | number | string;

export const decimal = (valor: MontoEntrada) => new Prisma.Decimal(valor);

export const CERO = new Prisma.Decimal(0);

export function sumar(valores: MontoEntrada[]): Prisma.Decimal {
  return valores.reduce<Prisma.Decimal>((acc, v) => acc.plus(decimal(v)), CERO);
}

export function toMonto(valor: MontoEntrada): number {
  return Number(decimal(valor).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP).toFixed(2));
}

// "$ 1.234,56" (es-AR), para mensajes al usuario y PDFs.
export function formatearPesos(valor: MontoEntrada): string {
  return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(toMonto(valor));
}
