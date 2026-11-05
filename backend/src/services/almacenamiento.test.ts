import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';

import { HttpError } from '../utils/httpError';

// D6: selección del driver, path traversal y token de la URL temporal local.
// almacenamiento importa config/env, que valida el entorno al cargarse: en CI
// no hay backend/.env, así que se cargan valores de prueba antes del import.
let alm: typeof import('./almacenamiento');

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.CLOUDINARY_CLOUD_NAME ??= 'test';
  process.env.CLOUDINARY_API_KEY ??= 'test';
  process.env.CLOUDINARY_API_SECRET ??= 'test';
  alm = await import('./almacenamiento');
});

const UUID = '0f8fad5b-d9cb-469f-a165-70867728950e';

const es403 = (err: unknown) => err instanceof HttpError && err.status === 403;

test('driver: sin STORAGE_DRIVER, test → memoria', () => {
  assert.deepEqual(alm.resolverDriver({ NODE_ENV: 'test', CLOUDINARY_CLOUD_NAME: 'demo' }), { driver: 'memoria' });
  assert.equal(alm.driverActual(), 'memoria');
});

test('driver: sin STORAGE_DRIVER, producción → cloudinary', () => {
  assert.equal(alm.resolverDriver({ NODE_ENV: 'production', CLOUDINARY_CLOUD_NAME: 'pendiente' }).driver, 'cloudinary');
});

test('driver: sin STORAGE_DRIVER, desarrollo → cloudinary si está configurado, si no → local', () => {
  assert.equal(alm.resolverDriver({ NODE_ENV: 'development', CLOUDINARY_CLOUD_NAME: 'demo' }).driver, 'cloudinary');
  assert.equal(alm.resolverDriver({ NODE_ENV: 'development', CLOUDINARY_CLOUD_NAME: 'pendiente' }).driver, 'local');
  assert.equal(alm.resolverDriver({ NODE_ENV: 'development', CLOUDINARY_CLOUD_NAME: 'Pendiente ' }).driver, 'local');
});

test('driver: STORAGE_DRIVER explícito manda en desarrollo y en test', () => {
  assert.equal(
    alm.resolverDriver({ NODE_ENV: 'development', STORAGE_DRIVER: 'local', CLOUDINARY_CLOUD_NAME: 'demo' }).driver,
    'local',
  );
  assert.equal(
    alm.resolverDriver({ NODE_ENV: 'development', STORAGE_DRIVER: 'cloudinary', CLOUDINARY_CLOUD_NAME: 'pendiente' })
      .driver,
    'cloudinary',
  );
  assert.equal(alm.resolverDriver({ NODE_ENV: 'test', STORAGE_DRIVER: 'local' }).driver, 'local');
});

test('driver: local en producción se ignora con warning y se usa cloudinary', () => {
  const r = alm.resolverDriver({ NODE_ENV: 'production', STORAGE_DRIVER: 'local' });
  assert.equal(r.driver, 'cloudinary');
  assert.match(r.advertencia ?? '', /prohibido en producción/);
});

test('driver: un valor inválido no rompe, avisa y elige según el entorno', () => {
  const r = alm.resolverDriver({ NODE_ENV: 'development', STORAGE_DRIVER: 's3', CLOUDINARY_CLOUD_NAME: 'pendiente' });
  assert.equal(r.driver, 'local');
  assert.match(r.advertencia ?? '', /no es válido/);
});

test('cloudinaryConfigurado: "pendiente" o "cambiar" en cualquier credencial → no configurado', () => {
  const ok = { CLOUDINARY_CLOUD_NAME: 'demo', CLOUDINARY_API_KEY: '123', CLOUDINARY_API_SECRET: 'xyz' };
  assert.equal(alm.cloudinaryConfigurado(ok), true);
  assert.equal(alm.cloudinaryConfigurado({ ...ok, CLOUDINARY_CLOUD_NAME: 'pendiente' }), false);
  assert.equal(alm.cloudinaryConfigurado({ ...ok, CLOUDINARY_API_SECRET: 'cambiar' }), false);
});

test('cloudinary sin configurar: 503 al usarlo (no al arrancar)', async () => {
  // env ya está cargado con credenciales "test": se fuerza el caso.
  const { env } = await import('../config/env');
  const previo = env.CLOUDINARY_CLOUD_NAME;
  env.CLOUDINARY_CLOUD_NAME = 'pendiente';
  try {
    await assert.rejects(
      alm.driverCloudinary.subirComprobante(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'),
      (err: unknown) =>
        err instanceof HttpError && err.status === 503 && err.message === alm.MSG_ALMACENAMIENTO_NO_CONFIGURADO,
    );
    // eliminar es best-effort: no lanza aunque falte la configuración.
    await alm.driverCloudinary.eliminar('x', 'image/jpeg');
  } finally {
    env.CLOUDINARY_CLOUD_NAME = previo;
  }
});

test('local: rechaza archivoId con separadores de ruta o fuera del formato <uuid>.<ext>', () => {
  for (const malo of [
    '../../.env',
    `../${UUID}.png`,
    `sub/${UUID}.png`,
    `sub\\${UUID}.png`,
    `${UUID}.exe`,
    `${UUID}.png/..`,
    '',
    // basename válido pero con directorio adelante: se rechaza, no se "limpia".
    `/etc/${UUID}.png`,
    `${alm.DIR_LOCAL}/${UUID}.png`,
    `./${UUID}.png`,
    // caracteres raros o variantes del formato
    `${UUID}.png\0`,
    `${UUID}.png%00.pdf`,
    `%2e%2e%2f${UUID}.png`,
    `${UUID.toUpperCase()}.png`,
    `${UUID}.PNG`,
    `${UUID}.png.exe`,
    `.${UUID}.png`,
    ` ${UUID}.png`,
    `${UUID}.png\n`,
    `${UUID.replace(/-/g, '')}.png`,
    '..',
    '.',
    '.env',
  ]) {
    assert.throws(() => alm.validarArchivoIdLocal(malo), es403, JSON.stringify(malo));
  }
  for (const ext of ['jpg', 'png', 'pdf']) {
    assert.equal(alm.validarArchivoIdLocal(`${UUID}.${ext}`), `${UUID}.${ext}`);
  }
});

test('local: resolverArchivoLocal devuelve solo el nombre validado (relativo a DIR_LOCAL) y el mime', () => {
  const token = alm.firmarTokenArchivo(`${UUID}.pdf`, 'application/pdf');
  assert.deepEqual(alm.resolverArchivoLocal(token), { nombre: `${UUID}.pdf`, tipo: 'application/pdf' });
});

test('local: resolverArchivoLocal con un token firmado que trae ruta o mime no admitido → 403', async () => {
  const { env } = await import('../config/env');
  const { createHmac } = await import('node:crypto');
  const clave = createHmac('sha256', env.JWT_ACCESS_SECRET).update('archivos-comprobantes').digest('hex');
  for (const payload of [
    { archivoId: `../${UUID}.png`, tipo: 'image/png' },
    { archivoId: `/tmp/${UUID}.png`, tipo: 'image/png' },
    { archivoId: `${UUID}.png`, tipo: 'text/html' },
    { archivoId: 42, tipo: 'image/png' },
  ]) {
    const token = jwt.sign(payload, clave, { expiresIn: 60 });
    assert.throws(() => alm.resolverArchivoLocal(token), es403, JSON.stringify(payload));
  }
});

test('local: token válido → archivoId y tipo', () => {
  const token = alm.firmarTokenArchivo(`${UUID}.png`, 'image/png');
  assert.deepEqual(alm.verificarTokenArchivo(token), { archivoId: `${UUID}.png`, tipo: 'image/png' });
});

test('local: token vencido → 403', () => {
  const token = alm.firmarTokenArchivo(`${UUID}.png`, 'image/png', -10);
  assert.throws(() => alm.verificarTokenArchivo(token), es403);
});

test('local: token adulterado → 403', () => {
  const token = alm.firmarTokenArchivo(`${UUID}.png`, 'image/png');
  const [h, p, s] = token.split('.');
  const otroPayload = Buffer.from(JSON.stringify({ archivoId: `${UUID}.pdf`, tipo: 'application/pdf' })).toString(
    'base64url',
  );
  assert.throws(() => alm.verificarTokenArchivo(`${h}.${otroPayload}.${s}`), es403);
  assert.throws(() => alm.verificarTokenArchivo(`${h}.${p}.${s.slice(0, -2)}xx`), es403);
  assert.throws(() => alm.verificarTokenArchivo('basura'), es403);
});

test('local: un token con path traversal firmado correctamente igual → 403', async () => {
  const { env } = await import('../config/env');
  const { createHmac } = await import('node:crypto');
  const clave = createHmac('sha256', env.JWT_ACCESS_SECRET).update('archivos-comprobantes').digest('hex');
  const token = jwt.sign({ archivoId: '../../.env', tipo: 'image/png' }, clave, { expiresIn: 60 });
  assert.throws(() => alm.verificarTokenArchivo(token), es403);
});

test('local: un access token común no sirve como token de archivo (y al revés)', async () => {
  const { env } = await import('../config/env');
  const access = jwt.sign({ archivoId: `${UUID}.png`, tipo: 'image/png' }, env.JWT_ACCESS_SECRET, { expiresIn: 60 });
  assert.throws(() => alm.verificarTokenArchivo(access), es403);
  const tokenArchivo = alm.firmarTokenArchivo(`${UUID}.png`, 'image/png');
  assert.throws(() => jwt.verify(tokenArchivo, env.JWT_ACCESS_SECRET));
});

test('local: la URL temporal apunta a /api/pagos/archivos/<token> y vence en 5 min', async () => {
  const antes = Date.now();
  const { url, expiraEn } = await alm.driverLocal.urlTemporal(`${UUID}.png`, 'image/png', 'http://localhost:4000/');
  assert.match(url, /^http:\/\/localhost:4000\/api\/pagos\/archivos\/[\w-]+\.[\w-]+\.[\w-]+$/);
  const ms = new Date(expiraEn).getTime() - antes;
  assert.ok(ms > 4 * 60 * 1000 && ms <= 5 * 60 * 1000 + 1000);
});

test('memoria: sube con id determinístico, da URL y elimina sin tocar disco ni red', async () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
  const a = await alm.almacenamiento.subirComprobante(png, 'image/png');
  const b = await alm.almacenamiento.subirComprobante(png, 'image/png');
  assert.equal(a.archivoId, b.archivoId);
  assert.match(a.archivoId, /^memoria\/[0-9a-f]{16}\.png$/);
  assert.equal(a.archivoTipo, 'image/png');
  assert.ok(alm.archivosEnMemoria.has(a.archivoId));
  const { url } = await alm.almacenamiento.urlTemporal(a.archivoId, a.archivoTipo, 'http://x');
  assert.match(url, /^http:\/\/x\/memoria\//);
  await alm.almacenamiento.eliminar(a.archivoId, a.archivoTipo);
  assert.equal(alm.archivosEnMemoria.has(a.archivoId), false);
});

test('mime no admitido → 400', async () => {
  await assert.rejects(
    alm.driverMemoria.subirComprobante(Buffer.from('hola'), 'text/plain'),
    (err: unknown) => err instanceof HttpError && err.status === 400,
  );
});
