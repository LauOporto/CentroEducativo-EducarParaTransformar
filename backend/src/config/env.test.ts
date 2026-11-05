import { test, before } from 'node:test';
import assert from 'node:assert/strict';

// D3: parser de CORS_ORIGIN. config/env valida todo el entorno al
// importarse (y hace process.exit si falta algo), así que se cargan
// valores de prueba antes del import dinámico: en CI no hay backend/.env.
let corsOriginSchema: typeof import('./env').corsOriginSchema;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.CLOUDINARY_CLOUD_NAME ??= 'test';
  process.env.CLOUDINARY_API_KEY ??= 'test';
  process.env.CLOUDINARY_API_SECRET ??= 'test';
  ({ corsOriginSchema } = await import('./env'));
});

test('CORS_ORIGIN sin cargar: queda el default del web en desarrollo', () => {
  assert.deepEqual(corsOriginSchema.parse(undefined), ['http://localhost:5173']);
});

test('CORS_ORIGIN con un solo origen', () => {
  assert.deepEqual(corsOriginSchema.parse('https://educar.onrender.com'), ['https://educar.onrender.com']);
});

test('CORS_ORIGIN con varios orígenes separados por coma', () => {
  assert.deepEqual(corsOriginSchema.parse('https://educar.onrender.com,http://localhost:8081'), [
    'https://educar.onrender.com',
    'http://localhost:8081',
  ]);
});

test('CORS_ORIGIN ignora espacios, comas sobrantes y la "/" final', () => {
  assert.deepEqual(corsOriginSchema.parse(' http://localhost:5173/ , ,http://localhost:8081 ,'), [
    'http://localhost:5173',
    'http://localhost:8081',
  ]);
});

test('CORS_ORIGIN con un origen inválido se rechaza', () => {
  assert.equal(corsOriginSchema.safeParse('http://localhost:5173,no-es-una-url').success, false);
});

test('CORS_ORIGIN vacío se rechaza', () => {
  assert.equal(corsOriginSchema.safeParse(' , ').success, false);
});
