import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { AccionAuditoria, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';

// RF-48 (D2 / A2): recuperar y cambiar la contraseña, con Prisma reemplazado
// por datos en memoria (patrón de panelFamilia.facade.test.ts). El envío
// del código se observa en el log de mail.service: en los tests nunca hay
// proveedor, así que el mail queda registrado en el logger. password.service
// importa config/env a través de sesion.service: se cargan valores de
// prueba antes del import dinámico, porque en CI no hay backend/.env.
let svc: typeof import('./password.service');

const ACTUAL = 'clave-actual';
const NUEVA = 'clave-nueva';
const MIN = 60 * 1000;

interface ResetFila {
  id: number;
  usuarioId: number;
  codigoHash: string;
  expiraEn: Date;
  intentos: number;
  usadoEn: Date | null;
  createdAt: Date;
}

let hashActual: string;
let users: { id: number; usuario: string; email: string; password: string; role: Role; isActive: boolean }[];
let resets: ResetFila[];
let sesiones: { id: number; usuarioId: number }[];
let auditoria: any[];
let mails: { to: string | null; contenido: string }[];

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.CLOUDINARY_CLOUD_NAME ??= 'test';
  process.env.CLOUDINARY_API_KEY ??= 'test';
  process.env.CLOUDINARY_API_SECRET ??= 'test';
  svc = await import('./password.service');
  hashActual = await bcrypt.hash(ACTUAL, 4);
});

// where de Prisma reducido a lo que usa password.service: igualdad, null,
// { gt } y { equals, mode: 'insensitive' }.
function coincide(fila: any, where: any): boolean {
  return Object.entries(where).every(([campo, cond]: [string, any]) => {
    const valor = fila[campo];
    if (cond === null) return valor === null;
    if (cond instanceof Date || typeof cond !== 'object') return valor === cond;
    if ('gt' in cond) return valor > cond.gt;
    if ('equals' in cond) return String(valor).toLowerCase() === String(cond.equals).toLowerCase();
    return false;
  });
}

beforeEach(() => {
  users = [
    { id: 1, usuario: 'padre', email: 'padre@mail.com', password: hashActual, role: Role.PADRE, isActive: true },
    { id: 2, usuario: 'baja', email: 'baja@mail.com', password: hashActual, role: Role.PADRE, isActive: false },
    { id: 3, usuario: 'otro', email: 'otro@mail.com', password: hashActual, role: Role.DOCENTE, isActive: true },
  ];
  resets = [];
  sesiones = [
    { id: 1, usuarioId: 1 },
    { id: 2, usuarioId: 1 },
    { id: 3, usuarioId: 3 },
  ];
  auditoria = [];
  mails = [];

  const userModel = {
    findUnique: async ({ where }: any) => users.find((u) => coincide(u, where)) ?? null,
    findFirst: async ({ where }: any) => users.find((u) => coincide(u, where)) ?? null,
    update: async ({ where, data }: any) =>
      Object.assign(
        users.find((u) => u.id === where.id)!,
        data,
      ),
  };
  const passwordResetModel = {
    create: async ({ data }: any) => {
      const fila = { id: resets.length + 1, intentos: 0, usadoEn: null, createdAt: new Date(), ...data };
      resets.push(fila);
      return fila;
    },
    findFirst: async ({ where }: any) =>
      resets.filter((r) => coincide(r, where)).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0] ?? null,
    update: async ({ where, data }: any) => {
      const fila = resets.find((r) => r.id === where.id)!;
      for (const [campo, valor] of Object.entries(data) as [keyof ResetFila, any][]) {
        (fila as any)[campo] = valor?.increment ? (fila[campo] as number) + valor.increment : valor;
      }
      return fila;
    },
    updateMany: async ({ where, data }: any) => {
      const filas = resets.filter((r) => coincide(r, where));
      filas.forEach((r) => Object.assign(r, data));
      return { count: filas.length };
    },
  };
  const sessionModel = {
    deleteMany: async ({ where }: any) => {
      const antes = sesiones.length;
      sesiones = sesiones.filter((s) => s.usuarioId !== where.usuarioId);
      return { count: antes - sesiones.length };
    },
  };

  Object.defineProperty(prisma, 'user', { configurable: true, value: userModel });
  Object.defineProperty(prisma, 'passwordReset', { configurable: true, value: passwordResetModel });
  Object.defineProperty(prisma, 'session', { configurable: true, value: sessionModel });
  Object.defineProperty(prisma, 'auditLog', {
    configurable: true,
    value: { create: async ({ data }: any) => auditoria.push(data) },
  });
  Object.defineProperty(prisma, '$transaction', {
    configurable: true,
    value: async (arg: any) =>
      typeof arg === 'function'
        ? arg({ user: userModel, passwordReset: passwordResetModel, session: sessionModel })
        : Promise.all(arg),
  });

  mock.restoreAll();
  mock.method(logger, 'info', (msg: string, meta: any) => {
    if (msg.startsWith('Mail sin enviar')) mails.push({ to: meta.to, contenido: meta.texto });
  });
  mock.method(logger, 'error', () => {});
});

const codigoInvalido = (err: unknown) =>
  err instanceof HttpError && err.status === 400 && err.message === 'Código inválido o vencido.';

// Pide un código y lo lee del mail enviado.
async function pedirCodigo(identificador = 'padre'): Promise<string> {
  await svc.solicitarRecuperacion(identificador);
  const codigo = mails.at(-1)?.contenido.match(/\b(\d{6})\b/)?.[1];
  assert.ok(codigo, 'el mail trae un código de 6 dígitos');
  return codigo;
}

const otroCodigo = (codigo: string) => String((Number(codigo) + 1) % 1_000_000).padStart(6, '0');

// ---- Olvidé mi contraseña ----

test('olvide: con una cuenta activa guarda el hash del código (vence en 15 min) y lo envía por email', async () => {
  const codigo = await pedirCodigo();
  assert.equal(resets.length, 1);
  assert.equal(mails.length, 1);
  assert.equal(mails[0].to, 'padre@mail.com');
  assert.match(mails[0].contenido, /Vence en 15 minutos/);
  assert.notEqual(resets[0].codigoHash, codigo);
  assert.equal(await bcrypt.compare(codigo, resets[0].codigoHash), true);
  const vence = resets[0].expiraEn.getTime() - Date.now();
  assert.ok(vence > 14 * MIN && vence <= 15 * MIN);
});

test('olvide: también encuentra la cuenta por email, sin distinguir mayúsculas', async () => {
  await pedirCodigo('  PADRE@Mail.com ');
  assert.equal(resets[0].usuarioId, 1);
});

test('e) olvide de una cuenta inexistente: misma respuesta (sin error) y ningún envío', async () => {
  assert.equal(await svc.solicitarRecuperacion('no-existe'), undefined);
  assert.equal(await svc.solicitarRecuperacion('nadie@mail.com'), undefined);
  assert.equal(resets.length, 0);
  assert.equal(mails.length, 0);
});

test('e) olvide de una cuenta deshabilitada: ningún código ni envío', async () => {
  await svc.solicitarRecuperacion('baja');
  assert.equal(resets.length, 0);
  assert.equal(mails.length, 0);
});

test('olvide: pedir un código nuevo invalida el anterior', async () => {
  const primero = await pedirCodigo();
  await pedirCodigo();
  assert.ok(resets[0].usadoEn, 'el primer código quedó invalidado');
  await assert.rejects(
    svc.restablecerPassword({ identificador: 'padre', codigo: primero, nuevaPassword: NUEVA }),
    codigoInvalido,
  );
});

// ---- Restablecer ----

test('f) código incorrecto: 400 genérico y suma un intento', async () => {
  const codigo = await pedirCodigo();
  await assert.rejects(
    svc.restablecerPassword({ identificador: 'padre', codigo: otroCodigo(codigo), nuevaPassword: NUEVA }),
    codigoInvalido,
  );
  assert.equal(resets[0].intentos, 1);
  assert.equal(resets[0].usadoEn, null);
});

test('f) al 5.º intento fallido el código queda invalidado aunque después llegue el correcto', async () => {
  const codigo = await pedirCodigo();
  for (let i = 1; i <= 5; i++) {
    await assert.rejects(
      svc.restablecerPassword({ identificador: 'padre', codigo: otroCodigo(codigo), nuevaPassword: NUEVA }),
      codigoInvalido,
    );
    assert.equal(resets[0].intentos, i);
    assert.equal(resets[0].usadoEn !== null, i === 5);
  }
  await assert.rejects(
    svc.restablecerPassword({ identificador: 'padre', codigo, nuevaPassword: NUEVA }),
    codigoInvalido,
  );
  assert.equal(await bcrypt.compare(ACTUAL, users[0].password), true, 'la contraseña no cambió');
});

test('restablecer con un código vencido: 400', async () => {
  const codigo = await pedirCodigo();
  resets[0].expiraEn = new Date(Date.now() - MIN);
  await assert.rejects(
    svc.restablecerPassword({ identificador: 'padre', codigo, nuevaPassword: NUEVA }),
    codigoInvalido,
  );
});

test('restablecer de una cuenta inexistente o sin código pedido: el mismo 400', async () => {
  await assert.rejects(
    svc.restablecerPassword({ identificador: 'no-existe', codigo: '123456', nuevaPassword: NUEVA }),
    codigoInvalido,
  );
  await assert.rejects(
    svc.restablecerPassword({ identificador: 'padre', codigo: '123456', nuevaPassword: NUEVA }),
    codigoInvalido,
  );
});

test('g) restablecer con éxito: cambia el hash, marca el código, borra las sesiones y audita', async () => {
  const codigo = await pedirCodigo();
  await svc.restablecerPassword({ identificador: 'padre', codigo, nuevaPassword: NUEVA });

  assert.equal(await bcrypt.compare(NUEVA, users[0].password), true);
  assert.ok(resets[0].usadoEn);
  assert.deepEqual(
    sesiones.map((s) => s.usuarioId),
    [3],
    'se borran todas las sesiones del usuario y solo las suyas',
  );
  assert.deepEqual(auditoria, [
    {
      usuarioId: 1,
      accion: AccionAuditoria.MODIFICACION,
      entidad: 'User',
      entidadId: 1,
      detalle: 'restablecimiento de contraseña',
    },
  ]);
});

test('g) un código ya usado no sirve una segunda vez', async () => {
  const codigo = await pedirCodigo();
  await svc.restablecerPassword({ identificador: 'padre', codigo, nuevaPassword: NUEVA });
  await assert.rejects(
    svc.restablecerPassword({ identificador: 'padre', codigo, nuevaPassword: 'otra-clave' }),
    codigoInvalido,
  );
});

// ---- Cambiar (con sesión iniciada) ----

test('h) cambiar con la contraseña actual incorrecta: 400 y no cambia nada', async () => {
  await assert.rejects(
    svc.cambiarPassword({ usuarioId: 1, passwordActual: 'equivocada', passwordNueva: NUEVA }),
    (err) => err instanceof HttpError && err.status === 400 && err.message === 'La contraseña actual no es correcta.',
  );
  assert.equal(await bcrypt.compare(ACTUAL, users[0].password), true);
  assert.equal(sesiones.length, 3);
  assert.equal(auditoria.length, 0);
});

test('cambiar a la misma contraseña: 400', async () => {
  await assert.rejects(
    svc.cambiarPassword({ usuarioId: 1, passwordActual: ACTUAL, passwordNueva: ACTUAL }),
    (err) => err instanceof HttpError && err.status === 400 && err.message === svc.MSG_PASSWORD_REPETIDA,
  );
});

test('cambiar con éxito: guarda la nueva, borra todas las sesiones y audita', async () => {
  await svc.cambiarPassword({ usuarioId: 1, passwordActual: ACTUAL, passwordNueva: NUEVA });
  assert.equal(await bcrypt.compare(NUEVA, users[0].password), true);
  assert.deepEqual(
    sesiones.map((s) => s.usuarioId),
    [3],
  );
  assert.equal(auditoria.length, 1);
  assert.equal(auditoria[0].detalle, 'cambio de contraseña');
});
