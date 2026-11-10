import { test } from 'node:test';
import assert from 'node:assert/strict';

import { domingoDePascua, esFeriado, feriadosNacionales, parseFeriadosExtra } from './feriados';
import { esUltimoDiaHabil, ultimoDiaHabilDelMes } from './fechas';

const iso = (d: Date) => d.toISOString().slice(0, 10);

test('domingo de Pascua (Meeus/Jones/Butcher)', () => {
  assert.equal(iso(domingoDePascua(2024)), '2024-03-31');
  assert.equal(iso(domingoDePascua(2025)), '2025-04-20');
  assert.equal(iso(domingoDePascua(2026)), '2026-04-05');
  assert.equal(iso(domingoDePascua(2027)), '2027-03-28');
});

test('feriados móviles por Pascua: Carnaval y Viernes Santo', () => {
  const f2026 = feriadosNacionales(2026);
  for (const d of ['2026-02-16', '2026-02-17', '2026-04-03']) assert.ok(f2026.has(d), d);
  const f2027 = feriadosNacionales(2027);
  for (const d of ['2027-02-08', '2027-02-09', '2027-03-26']) assert.ok(f2027.has(d), d);
});

test('feriados inamovibles', () => {
  for (const d of [
    '2026-01-01',
    '2026-03-24',
    '2026-04-02',
    '2026-05-01',
    '2026-05-25',
    '2026-06-20',
    '2026-07-09',
    '2026-12-08',
    '2026-12-25',
  ]) {
    assert.equal(esFeriado(d), true, d);
  }
  assert.equal(esFeriado('2026-11-30'), false);
});

test('trasladables (Ley 27.399): martes/miércoles al lunes anterior, jueves/viernes al lunes siguiente', () => {
  assert.equal(esFeriado('2026-06-15'), true); // 17/6/2026 es miércoles
  assert.equal(esFeriado('2026-06-17'), false);
  assert.equal(esFeriado('2026-11-23'), true); // 20/11/2026 es viernes
  assert.equal(esFeriado('2026-11-20'), false);
  assert.equal(esFeriado('2026-08-17'), true); // lunes: no se mueve
  assert.equal(esFeriado('2026-10-12'), true); // lunes: no se mueve
});

test('último día hábil saltea feriados: 29/03/2024 fue Viernes Santo', () => {
  assert.equal(ultimoDiaHabilDelMes('2024-03'), '2024-03-28');
  assert.equal(esUltimoDiaHabil('2024-03-29'), false);
  assert.equal(esUltimoDiaHabil('2024-03-28'), true);
});

test('FERIADOS_EXTRA suma puentes decretados y descarta valores inválidos', () => {
  const extras = parseFeriadosExtra(' 2026-11-30, basura ,2026-12-07,');
  assert.deepEqual([...extras], ['2026-11-30', '2026-12-07']);
  assert.equal(ultimoDiaHabilDelMes('2026-11', extras), '2026-11-27');
  assert.equal(esUltimoDiaHabil('2026-11-30', extras), false);
  assert.equal(parseFeriadosExtra(undefined).size, 0);
});
