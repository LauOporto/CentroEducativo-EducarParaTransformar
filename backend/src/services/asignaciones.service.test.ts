import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { actualizarAsignacion, crearAsignacion } from './asignaciones.service';

// RF-13 / HU4: reglas de la asignación Profesor–Materia–Curso. Los modelos
// de Prisma se reemplazan por datos en memoria, así el test no necesita
// base de datos (corre igual en el CI).
type Fila = { id: number; materiaId: number; cursoId: number; docenteId: number };
let filas: Fila[];

function usarModelo(nombre: string, metodos: Record<string, unknown>) {
  Object.defineProperty(prisma, nombre, { value: metodos, configurable: true });
}

const mismaTerna = (f: Fila, t: Omit<Fila, 'id'>) =>
  f.materiaId === t.materiaId && f.cursoId === t.cursoId && f.docenteId === t.docenteId;

beforeEach(() => {
  filas = [{ id: 1, materiaId: 10, cursoId: 20, docenteId: 30 }];
  usarModelo('materia', { findUnique: async ({ where }: any) => (where.id === 10 || where.id === 11 ? { id: where.id } : null) });
  usarModelo('curso', { findUnique: async ({ where }: any) => (where.id === 20 ? { id: 20 } : null) });
  usarModelo('user', {
    findUnique: async ({ where }: any) =>
      ({ 30: { id: 30, role: 'DOCENTE' }, 31: { id: 31, role: 'ESTUDIANTE' } })[where.id as 30 | 31] ?? null,
  });
  usarModelo('materiaCurso', {
    findUnique: async ({ where }: any) =>
      where.id !== undefined
        ? filas.find((f) => f.id === where.id) ?? null
        : filas.find((f) => mismaTerna(f, where.materiaId_cursoId_docenteId)) ?? null,
    findFirst: async ({ where }: any) => filas.find((f) => mismaTerna(f, where) && f.id !== where.NOT.id) ?? null,
    create: async ({ data }: any) => {
      const fila = { id: filas.length + 1, ...data };
      filas.push(fila);
      return fila;
    },
    update: async ({ where, data }: any) => Object.assign(filas.find((f) => f.id === where.id)!, data),
  });
});

const status = (status: number) => (err: unknown) => err instanceof HttpError && err.status === status;

test('crear una asignación nueva la guarda', async () => {
  const creada = await crearAsignacion({ materiaId: 11, cursoId: 20, docenteId: 30 });
  assert.equal(creada.materiaId, 11);
  assert.equal(filas.length, 2);
});

test('la terna profesor-materia-curso duplicada se rechaza con 409', async () => {
  await assert.rejects(crearAsignacion({ materiaId: 10, cursoId: 20, docenteId: 30 }), status(409));
  assert.equal(filas.length, 1);
});

test('solo se puede asignar a un usuario con rol DOCENTE', async () => {
  await assert.rejects(crearAsignacion({ materiaId: 11, cursoId: 20, docenteId: 31 }), status(400));
});

test('materia o curso inexistentes dan 400', async () => {
  await assert.rejects(crearAsignacion({ materiaId: 99, cursoId: 20, docenteId: 30 }), status(400));
  await assert.rejects(crearAsignacion({ materiaId: 10, cursoId: 99, docenteId: 30 }), status(400));
});

test('editar sin cambios no choca con la propia fila', async () => {
  const editada = await actualizarAsignacion(1, { materiaId: 10, cursoId: 20, docenteId: 30 });
  assert.equal(editada.id, 1);
});

test('editar hacia una terna que ya existe da 409', async () => {
  filas.push({ id: 2, materiaId: 11, cursoId: 20, docenteId: 30 });
  await assert.rejects(actualizarAsignacion(2, { materiaId: 10, cursoId: 20, docenteId: 30 }), status(409));
});
