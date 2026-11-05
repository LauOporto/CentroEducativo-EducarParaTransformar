import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from './httpError';
import { assertPuedeVerPagos } from './pagosAccess';

// D7 con Prisma en memoria (patrón de panelFamilia.facade.test.ts).
const USERS = [
  { id: 1, nombre: 'Patricia', role: Role.PADRE },
  { id: 2, nombre: 'Mariana', role: Role.PADRE },
  { id: 3, nombre: 'María López', role: Role.DOCENTE },
  { id: 10, nombre: 'Franco', role: Role.ESTUDIANTE, curso: { nombre: '1° año', nivel: { nombre: 'Secundaria' } } },
  { id: 11, nombre: 'María Gómez', role: Role.ESTUDIANTE, curso: null },
  { id: 99, nombre: 'Admin', role: Role.ADMIN },
];
const LINKS = [
  { padreId: 1, estudianteId: 10 },
  { padreId: 2, estudianteId: 11 },
];

beforeEach(() => {
  Object.defineProperty(prisma, 'user', {
    configurable: true,
    value: { findUnique: async ({ where }: any) => USERS.find((u) => u.id === where.id) ?? null },
  });
  Object.defineProperty(prisma, 'parentStudentLink', {
    configurable: true,
    value: {
      findUnique: async ({ where }: any) =>
        LINKS.find(
          (l) =>
            l.padreId === where.padreId_estudianteId.padreId &&
            l.estudianteId === where.padreId_estudianteId.estudianteId,
        ) ?? null,
    },
  });
});

const req = (id: number, role: Role) => ({ authUser: { id, usuario: 'x', role } });
const rechazo = (status: number, mensaje: string) => (err: unknown) =>
  err instanceof HttpError && err.status === status && err.message === mensaje;

test('ADMIN ve los pagos de cualquier alumno y recibe sus datos', async () => {
  const alumno = await assertPuedeVerPagos(req(99, Role.ADMIN), 10);
  assert.equal(alumno.nombre, 'Franco');
});

test('PADRE vinculado ve los pagos de su hijo', async () => {
  const alumno = await assertPuedeVerPagos(req(1, Role.PADRE), 10);
  assert.equal(alumno.id, 10);
});

test('PADRE no vinculado → 403', async () => {
  await assert.rejects(
    assertPuedeVerPagos(req(1, Role.PADRE), 11),
    rechazo(403, 'Ese alumno no está vinculado a tu cuenta.'),
  );
});

test('PADRE con un id inexistente → 403 (no revela qué ids existen)', async () => {
  await assert.rejects(
    assertPuedeVerPagos(req(1, Role.PADRE), 12345),
    rechazo(403, 'Ese alumno no está vinculado a tu cuenta.'),
  );
});

test('DOCENTE → 403, aunque el alumno exista', async () => {
  await assert.rejects(
    assertPuedeVerPagos(req(3, Role.DOCENTE), 10),
    rechazo(403, 'Tu rol no tiene acceso a la información de pagos.'),
  );
});

test('ESTUDIANTE → 403, incluso para sus propios pagos', async () => {
  await assert.rejects(
    assertPuedeVerPagos(req(10, Role.ESTUDIANTE), 10),
    rechazo(403, 'Tu rol no tiene acceso a la información de pagos.'),
  );
});

test('ADMIN con un alumno inexistente o un id que no es ESTUDIANTE → 404', async () => {
  await assert.rejects(assertPuedeVerPagos(req(99, Role.ADMIN), 12345), rechazo(404, 'El alumno indicado no existe.'));
  await assert.rejects(assertPuedeVerPagos(req(99, Role.ADMIN), 3), rechazo(404, 'El alumno indicado no existe.'));
});
