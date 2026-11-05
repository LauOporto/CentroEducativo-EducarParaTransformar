import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';

import { sumar, toMonto } from './montos';

test('sumar usa Decimal: 0.1 + 0.2 da exactamente 0.3', () => {
  assert.equal(sumar(['0.1', '0.2']).toString(), '0.3');
  assert.equal(toMonto(sumar([0.1, 0.2])), 0.3);
});

test('sumar de una lista vacía es 0', () => {
  assert.equal(sumar([]).toString(), '0');
});

test('sumar acepta Decimal, number y string', () => {
  assert.equal(toMonto(sumar([new Prisma.Decimal('260000.00'), 35000, '42500.50'])), 337500.5);
});

test('toMonto devuelve number con 2 decimales (redondeo comercial)', () => {
  assert.equal(toMonto(new Prisma.Decimal('180000')), 180000);
  assert.equal(toMonto('10.005'), 10.01);
  assert.equal(toMonto('10.004'), 10);
  assert.equal(typeof toMonto('1.50'), 'number');
});
