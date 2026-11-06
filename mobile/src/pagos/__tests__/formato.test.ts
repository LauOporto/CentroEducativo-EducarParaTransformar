// La zona del negocio: con new Date('2026-11-10') el día se correría al 09/11.
process.env.TZ = 'America/Argentina/Buenos_Aires';

import { diaArgentina, fechaCorta, fechaDeInstante, hoyArgentina, periodoLargo, pesos } from '../formato';

const NBSP = ' ';

describe('pesos (mismo formato que formatearPesos del backend)', () => {
  test('miles con punto y 2 decimales con coma', () => {
    expect(pesos(292000)).toBe(`$${NBSP}292.000,00`);
    expect(pesos(1234.5)).toBe(`$${NBSP}1.234,50`);
    expect(pesos(32000.05)).toBe(`$${NBSP}32.000,05`);
  });

  test('cero y montos chicos', () => {
    expect(pesos(0)).toBe(`$${NBSP}0,00`);
    expect(pesos(0.1 + 0.2)).toBe(`$${NBSP}0,30`);
    expect(pesos(999)).toBe(`$${NBSP}999,00`);
  });

  test('valores grandes y negativos', () => {
    expect(pesos(1234567890.99)).toBe(`$${NBSP}1.234.567.890,99`);
    expect(pesos(-5.5)).toBe(`-$${NBSP}5,50`);
  });
});

describe('fechas sin corrimiento de zona', () => {
  test('el test corre en la zona de Argentina', () => {
    // Prueba de que la TZ quedó aplicada: con new Date el día se corre.
    expect(new Date('2026-11-10T00:00:00.000Z').getDate()).toBe(9);
  });

  test('fechaCorta corta el texto: no corre el día', () => {
    expect(fechaCorta('2026-11-10T00:00:00.000Z')).toBe('10/11/2026');
    expect(fechaCorta('2026-11-10')).toBe('10/11/2026');
    expect(fechaCorta('2027-01-01')).toBe('01/01/2027');
  });

  test('instantes: el día de Argentina (UTC-3)', () => {
    // 01:30 UTC del 7/10 todavía es el 6/10 en Argentina.
    expect(diaArgentina('2026-10-07T01:30:00.000Z')).toBe('2026-10-06');
    expect(fechaDeInstante('2026-10-07T14:00:00.000Z')).toBe('07/10/2026');
    expect(hoyArgentina(Date.parse('2026-11-07T02:00:00.000Z'))).toBe('2026-11-06');
  });
});

test('periodoLargo', () => {
  expect(periodoLargo('2026-11')).toBe('Noviembre 2026');
  expect(periodoLargo('2027-01')).toBe('Enero 2027');
  expect(periodoLargo('2026-09')).toBe('Septiembre 2026');
});
