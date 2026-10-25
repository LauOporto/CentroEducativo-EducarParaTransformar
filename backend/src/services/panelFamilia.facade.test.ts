import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { inscribirDeporte } from './panelFamilia.facade';

// RF-18 (máximo 2 deportes), RF-21 (sin superposición horaria) y RF-22
// (sin duplicados) sobre inscribirDeporte, con Prisma reemplazado por datos
// en memoria, como en asignaciones.service.test.ts.
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const grupo = (id: number, deporteId: number, nombre: string, diaSemana: string, desde: string, hasta: string) => ({
  id,
  deporteId,
  deporte: { nombre },
  nivelId: 1,
  nivel: { nombre: 'Secundaria' },
  diaSemana,
  horaInicio: hora(desde),
  horaFin: hora(hasta),
  docenteId: 9,
  docente: { id: 9, nombre: 'Andrés Martínez' },
});

const GRUPOS = [
  grupo(1, 1, 'Fútbol', 'MARTES', '15:00', '16:30'),
  grupo(2, 2, 'Vóley', 'MIERCOLES', '14:00', '15:00'),
  grupo(3, 3, 'Básquet', 'VIERNES', '13:30', '14:30'),
  grupo(4, 3, 'Básquet', 'MARTES', '16:00', '17:00'), // se superpone con Fútbol
];

let inscripciones: { estudianteId: number; deporteId: number; grupoDeporteId: number }[];

beforeEach(() => {
  inscripciones = [];
  Object.defineProperty(prisma, 'grupoDeporte', {
    configurable: true,
    value: { findUnique: async ({ where }: any) => GRUPOS.find((g) => g.id === where.id) ?? null },
  });
  Object.defineProperty(prisma, 'inscripcionDeporte', {
    configurable: true,
    value: {
      findMany: async ({ where }: any) =>
        inscripciones
          .filter((i) => i.estudianteId === where.estudianteId)
          .map((i) => ({ ...i, grupoDeporte: GRUPOS.find((g) => g.id === i.grupoDeporteId) })),
      create: async ({ data }: any) => {
        inscripciones.push(data);
        return { ...data, grupoDeporte: GRUPOS.find((g) => g.id === data.grupoDeporteId) };
      },
    },
  });
});

const conflicto = (texto: string) => (err: unknown) =>
  err instanceof HttpError && err.status === 409 && err.message.includes(texto);

test('inscribe a un deporte disponible', async () => {
  const g = await inscribirDeporte(7, 1);
  assert.equal(g.deporte, 'Fútbol');
  assert.equal(inscripciones.length, 1);
});

test('RF-18: un tercer deporte se rechaza con 409', async () => {
  await inscribirDeporte(7, 1);
  await inscribirDeporte(7, 2);
  await assert.rejects(inscribirDeporte(7, 3), conflicto('ya está inscripto en 2 deportes'));
  assert.equal(inscripciones.length, 2);
});

test('RF-18: el límite es por alumno, no global', async () => {
  await inscribirDeporte(7, 1);
  await inscribirDeporte(7, 2);
  const g = await inscribirDeporte(8, 3);
  assert.equal(g.deporte, 'Básquet');
});

test('RF-22: el mismo deporte no se repite, aunque sea otro grupo', async () => {
  await inscribirDeporte(7, 3);
  await assert.rejects(inscribirDeporte(7, 4), conflicto('ya está inscripto en Básquet'));
});

test('RF-21: dos deportes el mismo día con horarios superpuestos se rechazan', async () => {
  await inscribirDeporte(7, 1);
  await assert.rejects(inscribirDeporte(7, 4), conflicto('se superpone con Fútbol'));
});

test('un grupo inexistente da 400', async () => {
  await assert.rejects(inscribirDeporte(7, 99), (err) => err instanceof HttpError && err.status === 400);
});
