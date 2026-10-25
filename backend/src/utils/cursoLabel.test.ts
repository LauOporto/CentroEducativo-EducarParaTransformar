import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { PrismaClient } from '@prisma/client';

import { formatCursoLabel, resolveCursoId } from './cursoLabel';
import { HttpError } from './httpError';

// resolveCursoId recibe el cliente de Prisma por parámetro: alcanza con un
// objeto que responda curso.findFirst para probarlo sin base de datos.
function prismaConCursos(cursos: { id: number; nombre: string; nivel: string }[]) {
  return {
    curso: {
      findFirst: async ({ where }: { where: { nombre: string; nivel: { nombre: string } } }) =>
        cursos.find((c) => c.nombre === where.nombre && c.nivel === where.nivel.nombre) ?? null,
    },
  } as unknown as PrismaClient;
}

const status = (status: number) => (err: unknown) => err instanceof HttpError && err.status === status;

test('formatCursoLabel arma "<Nivel> — <Curso>"', () => {
  assert.equal(formatCursoLabel({ nombre: '1° año', nivel: { nombre: 'Secundaria' } }), 'Secundaria — 1° año');
  assert.equal(formatCursoLabel(null), null);
});

test('resolveCursoId traduce la etiqueta al id del curso', async () => {
  const prisma = prismaConCursos([{ id: 12, nombre: '1° año', nivel: 'Secundaria' }]);
  assert.equal(await resolveCursoId(prisma, 'Secundaria — 1° año'), 12);
  assert.equal(await resolveCursoId(prisma, ''), null);
});

test('resolveCursoId rechaza etiquetas mal formadas o cursos inexistentes con 400', async () => {
  const prisma = prismaConCursos([{ id: 12, nombre: '1° año', nivel: 'Secundaria' }]);
  await assert.rejects(resolveCursoId(prisma, 'Secundaria 1° año'), status(400));
  await assert.rejects(resolveCursoId(prisma, 'Primaria — 1° año'), status(400));
});
