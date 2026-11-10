import { test } from 'node:test';
import assert from 'node:assert/strict';

import { recortarFinal, sinBarrasFinales, sinPuntoFinal } from './texto';

test('sinBarrasFinales quita solo las barras del final', () => {
  assert.equal(sinBarrasFinales('http://localhost:4000/'), 'http://localhost:4000');
  assert.equal(sinBarrasFinales('http://localhost:4000///'), 'http://localhost:4000');
  assert.equal(sinBarrasFinales('http://x/a/b'), 'http://x/a/b');
  assert.equal(sinBarrasFinales('///'), '');
  assert.equal(sinBarrasFinales(''), '');
});

test('sinPuntoFinal quita puntos y espacios del final, no del medio', () => {
  assert.equal(sinPuntoFinal('Monto incorrecto.'), 'Monto incorrecto');
  assert.equal(sinPuntoFinal('Monto incorrecto. . \n\t'), 'Monto incorrecto');
  assert.equal(sinPuntoFinal('Falta el nro. de operación'), 'Falta el nro. de operación');
  assert.equal(sinPuntoFinal('Ilegible '), 'Ilegible');
  assert.equal(sinPuntoFinal('...'), '');
});

test('recortarFinal es lineal: entradas patológicas para una regex con backtracking terminan al instante', () => {
  // /[.\s]+$/ y /\/+$/ con replace tardan O(n²) con esto.
  const largo = 200_000;
  const inicio = process.hrtime.bigint();
  assert.equal(sinPuntoFinal(`${'. '.repeat(largo)}x`).length, largo * 2 + 1);
  assert.equal(sinBarrasFinales(`${'/'.repeat(largo)}x`).length, largo + 1);
  assert.equal(
    recortarFinal('a'.repeat(largo), (c) => c === 'a'),
    '',
  );
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
  assert.ok(ms < 500, `tardó ${ms} ms`);
});

test('claveNombre ignora mayúsculas, tildes y espacios repetidos', async () => {
  const { claveNombre, hayNombreEquivalente } = await import('./texto');
  assert.equal(claveNombre('  Fútbol '), claveNombre('FUTBOL'));
  assert.equal(claveNombre('Primer   Turno'), claveNombre('primer turno'));
  assert.notEqual(claveNombre('Vóley'), claveNombre('Vóleibol'));
  const filas = [
    { id: 1, nombre: 'Fútbol' },
    { id: 2, nombre: 'Vóley' },
  ];
  assert.equal(hayNombreEquivalente(filas, 'futbol'), true);
  assert.equal(hayNombreEquivalente(filas, 'Futbol', 1), false); // editar el propio
  assert.equal(hayNombreEquivalente(filas, 'Ajedrez'), false);
});
