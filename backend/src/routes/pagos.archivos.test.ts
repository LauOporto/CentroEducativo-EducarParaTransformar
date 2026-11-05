import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import express from 'express';
import jwt from 'jsonwebtoken';

// D6, driver local: GET /api/pagos/archivos/:token sirve el comprobante con
// res.sendFile relativo a DIR_LOCAL. Se prueba la ruta real (router + error
// handler) contra un archivo real en disco: token válido → archivo, token
// con path traversal → 403, archivo inexistente → 404, otro driver → 404.
let alm: typeof import('../services/almacenamiento');
let server: Server;
let base: string;

const UUID = '6f9619ff-8b86-4d01-b42d-00c04fc964ff';
const CONTENIDO = Buffer.from('%PDF-1.4 comprobante de prueba');
const archivo = () => path.join(alm.DIR_LOCAL, `${UUID}.pdf`);

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_DRIVER = 'local';
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.CLOUDINARY_CLOUD_NAME ??= 'test';
  process.env.CLOUDINARY_API_KEY ??= 'test';
  process.env.CLOUDINARY_API_SECRET ??= 'test';
  alm = await import('../services/almacenamiento');
  const { pagosRouter } = await import('./pagos.routes');
  const { errorHandler } = await import('../middleware/errorHandler');

  await fs.mkdir(alm.DIR_LOCAL, { recursive: true });
  await fs.writeFile(archivo(), CONTENIDO);

  const app = express();
  app.use('/api/pagos', pagosRouter);
  app.use(errorHandler);
  server = app.listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/pagos/archivos/`;
});

after(async () => {
  await new Promise((r) => server.close(r));
  await fs.rm(archivo(), { force: true });
});

const firmarCrudo = async (payload: object) => {
  const { env } = await import('../config/env');
  const clave = createHmac('sha256', env.JWT_ACCESS_SECRET).update('archivos-comprobantes').digest('hex');
  return jwt.sign(payload, clave, { expiresIn: 60 });
};

test('archivos: token válido → 200 con el archivo, mime del token y sin caché', async () => {
  assert.equal(alm.driverActual(), 'local');
  const res = await fetch(base + alm.firmarTokenArchivo(`${UUID}.pdf`, 'application/pdf'));
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'application/pdf');
  assert.equal(res.headers.get('cache-control'), 'private, no-store');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.deepEqual(Buffer.from(await res.arrayBuffer()), CONTENIDO);
});

test('archivos: token firmado con path traversal → 403 y no se lee nada', async () => {
  for (const archivoId of ['../../.env', `../comprobantes/${UUID}.pdf`, `${alm.DIR_LOCAL}/${UUID}.pdf`]) {
    const res = await fetch(base + (await firmarCrudo({ archivoId, tipo: 'application/pdf' })));
    assert.equal(res.status, 403, archivoId);
    const body = (await res.json()) as { message: string };
    assert.equal(body.message, alm.MSG_TOKEN_ARCHIVO_INVALIDO);
  }
});

test('archivos: token basura o con ../ en la URL → 403 o 404, nunca 200', async () => {
  for (const sufijo of ['basura', '..%2F..%2F.env', `%2e%2e%2f${UUID}.pdf`]) {
    const res = await fetch(base + sufijo);
    assert.ok([403, 404].includes(res.status), `${sufijo} → ${res.status}`);
  }
});

test('archivos: token válido de un archivo que no existe → 404', async () => {
  const token = alm.firmarTokenArchivo('00000000-0000-4000-8000-000000000000.png', 'image/png');
  const res = await fetch(base + token);
  assert.equal(res.status, 404);
  assert.equal(((await res.json()) as { message: string }).message, 'El archivo no existe.');
});
