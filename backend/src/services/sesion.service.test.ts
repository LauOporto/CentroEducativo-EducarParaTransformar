import { test, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { esClienteMovil } from '../utils/clienteMovil';

// RF-48 (D1 / A2): login, refresh y logout de web y app móvil sobre la misma
// tabla Session, con Prisma reemplazado por datos en memoria (patrón de
// panelFamilia.facade.test.ts). sesion.service importa config/env, que
// valida el entorno al cargarse: en CI no hay backend/.env, así que se
// cargan valores de prueba antes del import dinámico.
let svc: typeof import('./sesion.service');
let auth: typeof import('../middleware/auth');

const PASSWORD = 'clave-segura';
const MIN = 60 * 1000;

interface UserFila {
  id: number;
  usuario: string;
  password: string;
  role: Role;
  nombre: string;
  isActive: boolean;
}
interface SesionFila {
  id: number;
  usuarioId: number;
  createdAt: Date;
  expiraEn: Date;
  ultimaActividad: Date;
}

let hash: string;
let users: UserFila[];
let sesiones: SesionFila[];
let sessionCreates: number;

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.CLOUDINARY_CLOUD_NAME ??= 'test';
  process.env.CLOUDINARY_API_KEY ??= 'test';
  process.env.CLOUDINARY_API_SECRET ??= 'test';
  svc = await import('./sesion.service');
  auth = await import('../middleware/auth');
  hash = await bcrypt.hash(PASSWORD, 4);
});

beforeEach(() => {
  const u = (id: number, usuario: string, role: Role, isActive = true): UserFila => ({
    id,
    usuario,
    password: hash,
    role,
    nombre: usuario,
    isActive,
  });
  users = [
    u(1, 'padre', Role.PADRE),
    u(2, 'docente', Role.DOCENTE),
    u(3, 'docente-pendiente', Role.DOCENTE, false),
    u(4, 'padre-baja', Role.PADRE, false),
    u(5, 'alumno', Role.ESTUDIANTE),
    u(6, 'admin', Role.ADMIN),
  ];
  sesiones = [];
  sessionCreates = 0;

  Object.defineProperty(prisma, 'user', {
    configurable: true,
    value: {
      findUnique: async ({ where }: any) =>
        users.find((x) => (where.id !== undefined ? x.id === where.id : x.usuario === where.usuario)) ?? null,
    },
  });
  Object.defineProperty(prisma, 'session', {
    configurable: true,
    value: {
      create: async ({ data }: any) => {
        sessionCreates += 1;
        const fila = { id: sesiones.length + 1, createdAt: new Date(), ultimaActividad: new Date(), ...data };
        sesiones.push(fila);
        return fila;
      },
      findUnique: async ({ where }: any) => sesiones.find((s) => s.id === where.id) ?? null,
      update: async ({ where, data }: any) => {
        const fila = sesiones.find((s) => s.id === where.id)!;
        Object.assign(fila, data);
        return fila;
      },
      delete: async ({ where }: any) => {
        sesiones = sesiones.filter((s) => s.id !== where.id);
      },
      deleteMany: async ({ where }: any) => {
        const antes = sesiones.length;
        sesiones = sesiones.filter((s) => s.id !== where.id);
        return { count: antes - sesiones.length };
      },
    },
  });
});

const rechazo = (status: number, mensaje: string) => (err: unknown) =>
  err instanceof HttpError && err.status === status && err.message === mensaje;

// Sesión ya existente, para probar el refresh sin pasar por el login.
function sesionCon(usuarioId: number, { creadaHace = 0, inactivaHace = 0 } = {}) {
  const ahora = Date.now();
  const fila: SesionFila = {
    id: sesiones.length + 1,
    usuarioId,
    createdAt: new Date(ahora - creadaHace),
    expiraEn: new Date(ahora - creadaHace + svc.SESSION_MAX_MS),
    ultimaActividad: new Date(ahora - inactivaHace),
  };
  sesiones.push(fila);
  return { fila, token: auth.signRefreshToken({ sessionId: fila.id }) };
}

// ---- Login ----

test('a) login móvil de un DOCENTE: 403 y no se crea la sesión', async () => {
  await assert.rejects(
    svc.iniciarSesion({ usuario: 'docente', password: PASSWORD, movil: true }),
    rechazo(403, svc.MSG_SOLO_PADRES),
  );
  assert.equal(sessionCreates, 0);
  assert.equal(sesiones.length, 0);
});

test('a) login móvil de un DOCENTE con contraseña errónea: 401 genérico, no revela el rol', async () => {
  await assert.rejects(
    svc.iniciarSesion({ usuario: 'docente', password: 'otra', movil: true }),
    rechazo(401, svc.MSG_CREDENCIALES_INVALIDAS),
  );
  assert.equal(sessionCreates, 0);
});

test('a) login móvil de un ADMIN: 403 (usa el campus web)', async () => {
  await assert.rejects(
    svc.iniciarSesion({ usuario: 'admin', password: PASSWORD, movil: true }),
    rechazo(403, svc.MSG_SOLO_PADRES),
  );
  assert.equal(sesiones.length, 0);
});

test('b) login móvil de un ESTUDIANTE: crea la sesión (gestiona sus propias inscripciones)', async () => {
  const sesion = await svc.iniciarSesion({ usuario: 'alumno', password: PASSWORD, movil: true });
  assert.equal(sesion.user.id, 5);
  assert.ok(sesion.accessToken);
  assert.equal(sesiones.length, 1);
});

test('refresh móvil de un ESTUDIANTE: renueva la sesión', async () => {
  const { token } = sesionCon(5);
  const sesion = await svc.refrescarSesion(token, { movil: true });
  assert.ok(sesion.accessToken);
  assert.equal(sesiones.length, 1);
});

test('b) login móvil de un PADRE: crea la sesión y devuelve access y refresh token', async () => {
  const sesion = await svc.iniciarSesion({ usuario: 'padre', password: PASSWORD, movil: true });
  assert.equal(sesion.user.id, 1);
  assert.ok(sesion.accessToken);
  assert.equal(auth.verifyRefreshToken(sesion.refreshToken).sessionId, sesiones[0].id);
  assert.equal(sessionCreates, 1);
  assert.equal(sesiones[0].expiraEn.getTime() - Date.now() <= svc.SESSION_MAX_MS, true);
});

test('login web de un DOCENTE sigue funcionando (el filtro de rol es solo móvil)', async () => {
  const sesion = await svc.iniciarSesion({ usuario: 'docente', password: PASSWORD, movil: false });
  assert.equal(sesion.user.role, Role.DOCENTE);
  assert.equal(sessionCreates, 1);
});

test('c) usuario inexistente y contraseña incorrecta: el mismo 401 con el mismo texto', async () => {
  const errores: HttpError[] = [];
  for (const intento of [
    { usuario: 'no-existe', password: PASSWORD },
    { usuario: 'padre', password: 'incorrecta' },
  ]) {
    await svc.iniciarSesion({ ...intento, movil: false }).catch((e: HttpError) => errores.push(e));
  }
  assert.equal(errores.length, 2);
  for (const e of errores) {
    assert.equal(e.status, 401);
    assert.equal(e.message, 'Usuario o contraseña incorrectos.');
  }
  assert.equal(sessionCreates, 0);
});

test('c) cuenta deshabilitada o docente pendiente: solo se informa con la contraseña correcta', async () => {
  await assert.rejects(
    svc.iniciarSesion({ usuario: 'padre-baja', password: 'incorrecta', movil: false }),
    rechazo(401, svc.MSG_CREDENCIALES_INVALIDAS),
  );
  await assert.rejects(
    svc.iniciarSesion({ usuario: 'padre-baja', password: PASSWORD, movil: false }),
    rechazo(401, 'La cuenta está deshabilitada.'),
  );
  await assert.rejects(
    svc.iniciarSesion({ usuario: 'docente-pendiente', password: PASSWORD, movil: false }),
    rechazo(401, 'Tu cuenta de docente está pendiente de aprobación por un administrador.'),
  );
  assert.equal(sessionCreates, 0);
});

// ---- Refresh ----

test('d) refresh de una sesión con más de 24hs: 401 y se borra la sesión', async () => {
  const { token } = sesionCon(1, { creadaHace: svc.SESSION_MAX_MS + MIN });
  await assert.rejects(svc.refrescarSesion(token, { movil: true }), rechazo(401, svc.MSG_SESION_VENCIDA));
  assert.equal(sesiones.length, 0);
});

test('d) refresh tras más de 30min de inactividad: 401 y se borra la sesión', async () => {
  const { token } = sesionCon(1, { inactivaHace: svc.SESSION_INACTIVITY_MS + MIN });
  await assert.rejects(svc.refrescarSesion(token, { movil: true }), rechazo(401, svc.MSG_SESION_INACTIVA));
  assert.equal(sesiones.length, 0);
});

test('d) refresh de una sesión inexistente (por ejemplo, después del logout): 401', async () => {
  const { fila, token } = sesionCon(1);
  await svc.cerrarSesion(token);
  assert.equal(
    sesiones.find((s) => s.id === fila.id),
    undefined,
  );
  await assert.rejects(svc.refrescarSesion(token, { movil: true }), rechazo(401, svc.MSG_SESION_INVALIDA));
});

test('d) refresh de un usuario deshabilitado: 401 y se borra la sesión', async () => {
  const { token } = sesionCon(4);
  await assert.rejects(svc.refrescarSesion(token, { movil: true }), rechazo(401, svc.MSG_CUENTA_DESHABILITADA));
  assert.equal(sesiones.length, 0);
});

test('d) refresh sin token o con un token adulterado: 401', async () => {
  await assert.rejects(svc.refrescarSesion(undefined, { movil: true }), rechazo(401, 'No hay refresh token.'));
  await assert.rejects(
    svc.refrescarSesion('no.es.un-jwt', { movil: true }),
    rechazo(401, 'Refresh token inválido o expirado.'),
  );
});

test('d) refresh válido: rota el token y actualiza ultimaActividad', async () => {
  const { fila, token } = sesionCon(1, { inactivaHace: 10 * MIN });
  const actividadAnterior = fila.ultimaActividad.getTime();
  const expiraAnterior = fila.expiraEn.getTime();

  const sesion = await svc.refrescarSesion(token, { movil: true });

  assert.notEqual(sesion.refreshToken, token);
  assert.equal(auth.verifyRefreshToken(sesion.refreshToken).sessionId, fila.id);
  assert.ok(sesion.accessToken);
  assert.ok(fila.ultimaActividad.getTime() > actividadAnterior);
  assert.equal(fila.expiraEn.getTime(), expiraAnterior, 'el tope de 24hs nunca se extiende');
});

test('refresh móvil de un DOCENTE (no es PADRE ni ESTUDIANTE): 403 y se borra la sesión', async () => {
  const { token } = sesionCon(2);
  await assert.rejects(svc.refrescarSesion(token, { movil: true }), rechazo(403, svc.MSG_SOLO_PADRES));
  assert.equal(sesiones.length, 0);
});

test('refresh web de un DOCENTE sigue funcionando', async () => {
  const { token } = sesionCon(2);
  const sesion = await svc.refrescarSesion(token, { movil: false });
  assert.equal(sesion.user.role, Role.DOCENTE);
});

// ---- Logout ----

test('logout con un token inválido o sin token no falla', async () => {
  sesionCon(1);
  await svc.cerrarSesion(undefined);
  await svc.cerrarSesion('basura');
  assert.equal(sesiones.length, 1);
});

// ---- Detección del cliente ----

test('esClienteMovil: compara X-Client-Type sin importar mayúsculas', () => {
  const req = (valor?: string) => ({ get: (h: string) => (h.toLowerCase() === 'x-client-type' ? valor : undefined) });
  assert.equal(esClienteMovil(req('mobile') as any), true);
  assert.equal(esClienteMovil(req('MOBILE') as any), true);
  assert.equal(esClienteMovil(req(' Mobile ') as any), true);
  assert.equal(esClienteMovil(req('web') as any), false);
  assert.equal(esClienteMovil(req(undefined) as any), false);
});

test('hashFicticio: se genera una sola vez, es bcrypt y no coincide con ninguna contraseña', async () => {
  const h = svc.hashFicticio();
  assert.equal(svc.hashFicticio(), h);
  assert.match(h, /^\$2[aby]\$10\$/);
  assert.equal(await bcrypt.compare(PASSWORD, h), false);
  assert.equal(await bcrypt.compare('', h), false);
});
