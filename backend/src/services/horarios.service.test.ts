import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buscarConflicto, seSolapan, type BloqueExistente } from './horarios.service';

// Parte 2 — horario de cursado: reglas de solapamiento, sobre la función
// pura (sin base de datos).

const bloque = (
  id: number,
  cursoId: number,
  docenteId: number,
  diaSemana: BloqueExistente['diaSemana'],
  horaInicio: string,
  horaFin: string,
  descripcion = 'Matemática — Secundaria — 1° año',
): BloqueExistente => ({ id, cursoId, docenteId, diaSemana, horaInicio, horaFin, descripcion });

const EXISTENTES = [
  bloque(1, 10, 100, 'LUNES', '08:00', '09:20'), // curso 10, profe 100
  bloque(2, 20, 200, 'LUNES', '10:00', '11:20', 'Lengua — Secundaria — 2° año'),
];

test('seSolapan: rangos semiabiertos, mismo día', () => {
  const a = { diaSemana: 'LUNES' as const, horaInicio: '08:00', horaFin: '09:00' };
  assert.equal(seSolapan(a, { diaSemana: 'LUNES', horaInicio: '08:30', horaFin: '09:30' }), true);
  assert.equal(seSolapan(a, { diaSemana: 'LUNES', horaInicio: '09:00', horaFin: '10:00' }), false); // termina justo
  assert.equal(seSolapan(a, { diaSemana: 'MARTES', horaInicio: '08:00', horaFin: '09:00' }), false);
});

test('rechaza dos materias del mismo curso en la misma franja', () => {
  const motivo = buscarConflicto(
    { diaSemana: 'LUNES', horaInicio: '09:00', horaFin: '10:00', cursoId: 10, docenteId: 300 },
    EXISTENTES,
    [],
  );
  assert.match(motivo ?? '', /El curso ya tiene Matemática/);
});

test('rechaza al mismo profesor en dos cursos a la vez', () => {
  const motivo = buscarConflicto(
    { diaSemana: 'LUNES', horaInicio: '10:30', horaFin: '11:30', cursoId: 30, docenteId: 200 },
    EXISTENTES,
    [],
  );
  assert.match(motivo ?? '', /El profesor ya dicta Lengua/);
});

test('rechaza si el profesor dirige un grupo de deporte en esa franja', () => {
  const motivo = buscarConflicto(
    { diaSemana: 'MARTES', horaInicio: '15:00', horaFin: '16:00', cursoId: 30, docenteId: 100 },
    EXISTENTES,
    [{ diaSemana: 'MARTES', horaInicio: '15:30', horaFin: '17:00', descripcion: 'Fútbol (Secundaria)' }],
  );
  assert.match(motivo ?? '', /Fútbol \(Secundaria\)/);
});

test('acepta franjas libres, y al editar ignora el propio bloque', () => {
  assert.equal(
    buscarConflicto(
      { diaSemana: 'LUNES', horaInicio: '09:20', horaFin: '10:00', cursoId: 10, docenteId: 100 },
      EXISTENTES,
      [],
    ),
    null,
  );
  assert.equal(
    buscarConflicto(
      { diaSemana: 'LUNES', horaInicio: '08:10', horaFin: '09:10', cursoId: 10, docenteId: 100, excluirId: 1 },
      EXISTENTES,
      [],
    ),
    null,
  );
});
