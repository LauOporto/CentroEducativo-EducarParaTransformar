import { test } from 'node:test';
import assert from 'node:assert/strict';

import { dniSchema, fechaNacimientoSchema, telefonoSchema } from './validators';

// RNF-40: DNI de 7 u 8 dígitos y teléfono solo con dígitos.
test('dniSchema acepta 7 u 8 dígitos y rechaza el resto', () => {
  assert.ok(dniSchema.safeParse('1234567').success);
  assert.ok(dniSchema.safeParse('12345678').success);
  for (const dni of ['123456', '123456789', '12.345.678', 'abcdefgh', '']) {
    assert.equal(dniSchema.safeParse(dni).success, false, `debería rechazar "${dni}"`);
  }
});

test('telefonoSchema rechaza separadores y letras', () => {
  assert.ok(telefonoSchema.safeParse('1112345678').success);
  for (const tel of ['011-1234-5678', '+5491112345678', '12345', 'telefono']) {
    assert.equal(telefonoSchema.safeParse(tel).success, false, `debería rechazar "${tel}"`);
  }
});

test('fechaNacimientoSchema no admite fechas futuras', () => {
  const manana = new Date(Date.now() + 24 * 60 * 60 * 1000);
  assert.ok(fechaNacimientoSchema.safeParse('2015-03-20').success);
  assert.equal(fechaNacimientoSchema.safeParse(manana).success, false);
});
