import { test } from 'node:test';
import assert from 'node:assert/strict';

import { HttpError } from './httpError';
import {
  hoyArgentina,
  parseRangoFechas,
  periodoSiguiente,
  sumarMeses,
  validarPeriodo,
  vencimientoDePeriodo,
} from './fechas';

const es400 = (err: unknown) => err instanceof HttpError && err.status === 400;

test('hoyArgentina usa la zona del colegio, no UTC', () => {
  // 02:00 UTC del 1/12 todavía es 30/11 a las 23:00 en Argentina.
  assert.equal(hoyArgentina(new Date('2026-12-01T02:00:00Z')), '2026-11-30');
  assert.equal(hoyArgentina(new Date('2026-12-01T03:00:00Z')), '2026-12-01');
});

test('validarPeriodo acepta AAAA-MM y rechaza el resto con 400', () => {
  assert.equal(validarPeriodo('2026-11'), '2026-11');
  for (const malo of ['2026-13', '2026-00', '2026-1', '26-11', '2026/11', '']) {
    assert.throws(() => validarPeriodo(malo), es400, malo);
  }
});

test('vencimientoDePeriodo: día 10 del período a medianoche UTC (@db.Date)', () => {
  assert.equal(vencimientoDePeriodo('2026-11').toISOString(), '2026-11-10T00:00:00.000Z');
  assert.equal(vencimientoDePeriodo('2027-02').toISOString(), '2027-02-10T00:00:00.000Z');
});

test('periodoSiguiente cruza el cambio de año', () => {
  assert.equal(periodoSiguiente('2026-11'), '2026-12');
  assert.equal(periodoSiguiente('2026-12'), '2027-01');
});

test('sumarMeses ajusta al último día del mes (febrero y bisiesto)', () => {
  assert.equal(sumarMeses('2026-08-31', 6), '2027-02-28');
  assert.equal(sumarMeses('2027-08-31', 6), '2028-02-29');
  assert.equal(sumarMeses('2026-11-05', -6), '2026-05-05');
  assert.equal(sumarMeses('2026-11-05', 2), '2027-01-05');
});

test('parseRangoFechas: default de hoy − 6 meses a hoy + 2 meses', () => {
  assert.deepEqual(parseRangoFechas(undefined, undefined, '2026-11-05'), { desde: '2026-05-05', hasta: '2027-01-05' });
  assert.deepEqual(parseRangoFechas('', '', '2026-11-05'), { desde: '2026-05-05', hasta: '2027-01-05' });
});

test('parseRangoFechas: rango custom', () => {
  assert.deepEqual(parseRangoFechas('2026-10-01', '2026-10-31'), { desde: '2026-10-01', hasta: '2026-10-31' });
});

test('parseRangoFechas: exactamente 24 meses es válido; 24 meses + 1 día, no', () => {
  assert.deepEqual(parseRangoFechas('2025-01-01', '2027-01-01'), { desde: '2025-01-01', hasta: '2027-01-01' });
  assert.throws(
    () => parseRangoFechas('2025-01-01', '2027-01-02'),
    (err) => es400(err) && (err as Error).message === 'El rango de fechas no puede superar los 24 meses.',
  );
});

test('parseRangoFechas: rango de 24 meses que arranca a fin de febrero', () => {
  assert.doesNotThrow(() => parseRangoFechas('2026-02-28', '2028-02-28'));
  assert.throws(() => parseRangoFechas('2026-02-28', '2028-02-29'), es400);
});

test('parseRangoFechas: desde posterior a hasta → 400', () => {
  assert.throws(() => parseRangoFechas('2026-11-01', '2026-10-01'), es400);
});

test('parseRangoFechas: formato o fecha inexistente → 400', () => {
  for (const [d, h] of [
    ['2026/10/01', '2026-10-31'],
    ['2026-02-30', '2026-03-31'],
    ['2026-10-01', 'mañana'],
  ]) {
    assert.throws(() => parseRangoFechas(d, h), es400, `${d} ${h}`);
  }
});
