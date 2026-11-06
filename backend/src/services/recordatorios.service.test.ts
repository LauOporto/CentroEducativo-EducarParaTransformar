import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ConceptoCuota, EstadoCuota, EstadoFactura, Prisma, Role, TipoRecordatorio } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import type { Mail } from './mail.service';

// HU9 (D11): mails automáticos de facturación, con Prisma en memoria (patrón
// de facturacion.fixture.ts) y el envío, el PDF y la generación de facturas
// reemplazados por dobles. recordatorios.service importa config/env: se
// cargan valores de prueba antes del import dinámico.
let svc: typeof import('./recordatorios.service');

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.CLOUDINARY_CLOUD_NAME ??= 'test';
  process.env.CLOUDINARY_API_KEY ??= 'test';
  process.env.CLOUDINARY_API_SECRET ??= 'test';
  svc = await import('./recordatorios.service');
});

const D = (v: number) => new Prisma.Decimal(v);
const AHORA = new Date('2026-11-30T11:00:00.000Z');

interface Envio {
  tipo: TipoRecordatorio;
  facturaId: number;
  padreId: number;
  ok: boolean;
  error: string | null;
  enviadoEn: Date;
}

let facturas: any[];
let envios: Envio[];
let mails: Mail[];
let generadas: { periodo: string; usuarioId?: number }[];
let fallarPara: Set<string>;

const padre = (id: number, extra: Partial<{ isActive: boolean; role: Role }> = {}) => ({
  padre: { id, nombre: `Padre ${id}`, email: `padre${id}@mail.com`, isActive: true, role: Role.PADRE, ...extra },
});

function factura(id: number, periodo: string, opts: { estado?: EstadoFactura; pagado?: number; padres?: any[] } = {}) {
  return {
    id,
    numero: `F-${periodo.replace('-', '')}-${String(id).padStart(6, '0')}`,
    periodo,
    vencimiento: new Date(`${periodo}-10T00:00:00.000Z`),
    total: D(290000),
    estado: opts.estado ?? EstadoFactura.PENDIENTE,
    cuotas: [
      {
        concepto: ConceptoCuota.CUOTA,
        descripcion: 'Cuota mensual — Secundaria',
        importe: D(260000),
        estado: EstadoCuota.PENDIENTE as EstadoCuota,
      },
      {
        concepto: ConceptoCuota.DEPORTE,
        descripcion: 'Fútbol — Martes 15:00 a 16:30',
        importe: D(30000),
        estado: EstadoCuota.PENDIENTE as EstadoCuota,
      },
    ],
    pagos: opts.pagado ? [{ monto: D(opts.pagado) }] : [],
    estudiante: { nombre: `Alumno ${id}`, padres: opts.padres ?? [padre(100 + id)] },
  };
}

const clave = (e: Pick<Envio, 'tipo' | 'facturaId' | 'padreId'>) => `${e.tipo}|${e.facturaId}|${e.padreId}`;

beforeEach(() => {
  facturas = [];
  envios = [];
  mails = [];
  generadas = [];
  fallarPara = new Set();

  Object.defineProperty(prisma, 'factura', {
    configurable: true,
    value: {
      findMany: async ({ where }: any) =>
        facturas.filter((f) => f.periodo === where.periodo && (!where.estado || where.estado.in.includes(f.estado))),
    },
  });
  Object.defineProperty(prisma, 'envioRecordatorio', {
    configurable: true,
    value: {
      create: async ({ data }: any) => {
        if (envios.some((e) => clave(e) === clave(data)))
          throw Object.assign(new Error('duplicado'), { code: 'P2002' });
        envios.push({ ...data });
        return data;
      },
      updateMany: async ({ where, data }: any) => {
        const [noEnCurso, vencida] = where.OR;
        const coinciden = envios.filter(
          (e) =>
            clave(e) === clave(where) &&
            e.ok === where.ok &&
            (e.error !== noEnCurso.error.not || e.enviadoEn < vencida.enviadoEn.lt),
        );
        coinciden.forEach((e) => Object.assign(e, data));
        return { count: coinciden.length };
      },
      update: async ({ where, data }: any) => {
        const e = envios.find((x) => clave(x) === clave(where.tipo_facturaId_padreId));
        if (!e) throw new Error('no existe');
        return Object.assign(e, data);
      },
    },
  });

  mock.restoreAll();
  mock.method(logger, 'info', () => {});
  mock.method(logger, 'error', () => {});
});

const deps = () => ({
  enviar: async (mail: Mail) => {
    if (fallarPara.has(mail.para)) throw new Error('Resend respondió 500');
    mails.push(mail);
  },
  pdf: async (facturaId: number) => Buffer.from(`pdf-${facturaId}`),
  generarFacturas: async (periodo: string, usuarioId?: number) => {
    generadas.push({ periodo, usuarioId });
    return { periodo, creadas: 0, omitidas: 0, detalleOmitidas: [] };
  },
  ahora: () => AHORA,
});

// ---- Qué corre cada día ----

test('el último día hábil emite el mes siguiente; el día 20 avisa la deuda del mes', () => {
  assert.deepEqual(svc.tareasDelDia('2026-11-30'), [{ tipo: 'EMISION', periodo: '2026-12' }]);
  assert.deepEqual(svc.tareasDelDia('2026-01-30'), [{ tipo: 'EMISION', periodo: '2026-02' }]); // el 31 es sábado
  assert.deepEqual(svc.tareasDelDia('2026-12-31'), [{ tipo: 'EMISION', periodo: '2027-01' }]);
  assert.deepEqual(svc.tareasDelDia('2026-11-20'), [{ tipo: 'DEUDA', periodo: '2026-11' }]);
  assert.deepEqual(svc.tareasDelDia('2026-11-27'), []);
});

test('un día sin tareas no genera ni manda nada', async () => {
  facturas.push(factura(1, '2026-11'));
  const r = await svc.ejecutarJobsDiarios('2026-11-18', deps());
  assert.deepEqual(r, { fecha: '2026-11-18', tareas: [] });
  assert.equal(generadas.length, 0);
  assert.equal(mails.length, 0);
});

// ---- Emisión ----

test('emisión: genera las facturas y manda a cada padre la de su hijo con la composición y el PDF', async () => {
  facturas.push(factura(1, '2026-12', { padres: [padre(11), padre(12)] }), factura(2, '2026-12'));

  const r = await svc.ejecutarJobsDiarios('2026-11-30', deps());

  assert.deepEqual(generadas, [{ periodo: '2026-12', usuarioId: undefined }]);
  const [t] = r.tareas;
  assert.equal(t.tipo, 'EMISION');
  assert.equal(t.facturas, 2);
  assert.equal(t.enviados, 3);
  assert.deepEqual(
    mails.map((m) => m.para),
    ['padre11@mail.com', 'padre12@mail.com', 'padre102@mail.com'],
  );
  const m = mails[0];
  assert.equal(m.asunto, 'Factura de Diciembre 2026 — Alumno 1');
  assert.match(m.texto, /- Cuota mensual — Secundaria: \$\s260\.000,00/);
  assert.match(m.texto, /- Deporte: Fútbol — Martes 15:00 a 16:30: \$\s30\.000,00/);
  assert.match(m.texto, /Total: \$\s290\.000,00/);
  assert.match(m.texto, /Vence el 10\/12\/2026/);
  assert.match(m.texto, /CBU: /);
  assert.deepEqual(
    m.adjuntos?.map((a) => a.nombre),
    ['factura-F-202612-000001.pdf'],
  );
  assert.ok(envios.every((e) => e.ok && e.error === null));
});

test('emisión manual del admin: la generación queda a su nombre', async () => {
  await svc.enviarEmision('2026-12', { usuarioId: 1 }, deps());
  assert.deepEqual(generadas, [{ periodo: '2026-12', usuarioId: 1 }]);
});

test('correr el job dos veces no repite mails', async () => {
  facturas.push(factura(1, '2026-12'));
  await svc.ejecutarJobsDiarios('2026-11-30', deps());
  const r = await svc.ejecutarJobsDiarios('2026-11-30', deps());
  assert.equal(r.tareas[0].enviados, 0);
  assert.equal(r.tareas[0].yaEnviados, 1);
  assert.equal(mails.length, 1);
});

test('un envío fallido queda registrado y se reintenta solo ese en la próxima corrida', async () => {
  facturas.push(factura(1, '2026-12'), factura(2, '2026-12'));
  fallarPara.add('padre101@mail.com');

  const r1 = await svc.enviarEmision('2026-12', {}, deps());
  assert.equal(r1.enviados, 1);
  assert.equal(r1.fallidos, 1);
  assert.deepEqual(r1.errores, [{ facturaId: 1, padreId: 101, error: 'Resend respondió 500' }]);
  assert.deepEqual(
    envios.map((e) => [e.facturaId, e.ok, e.error]),
    [
      [1, false, 'Resend respondió 500'],
      [2, true, null],
    ],
  );

  fallarPara.clear();
  const r2 = await svc.enviarEmision('2026-12', {}, deps());
  assert.equal(r2.enviados, 1);
  assert.equal(r2.yaEnviados, 1);
  assert.deepEqual(
    mails.map((m) => m.para),
    ['padre102@mail.com', 'padre101@mail.com'],
  );
});

test('un envío "en curso" de otra corrida no se repite, salvo que la reserva tenga más de 15 minutos', async () => {
  facturas.push(factura(1, '2026-12'), factura(2, '2026-12'));
  const base = { tipo: TipoRecordatorio.EMISION, ok: false, error: svc.EN_CURSO };
  envios.push(
    { ...base, facturaId: 1, padreId: 101, enviadoEn: new Date(AHORA.getTime() - 5 * 60 * 1000) },
    { ...base, facturaId: 2, padreId: 102, enviadoEn: new Date(AHORA.getTime() - 20 * 60 * 1000) },
  );

  const r = await svc.enviarEmision('2026-12', {}, deps());

  assert.equal(r.yaEnviados, 1);
  assert.equal(r.enviados, 1);
  assert.deepEqual(
    mails.map((m) => m.para),
    ['padre102@mail.com'],
  );
});

test('facturas sin padres activos se cuentan aparte y no se manda nada', async () => {
  facturas.push(
    factura(1, '2026-12', { padres: [] }),
    factura(2, '2026-12', { padres: [padre(21, { isActive: false })] }),
  );
  const r = await svc.enviarEmision('2026-12', {}, deps());
  assert.equal(r.sinDestinatario, 2);
  assert.equal(mails.length, 0);
});

// ---- Deuda ----

test('deuda: solo facturas no pagadas con saldo, con el saldo y los ítems pendientes', async () => {
  const parcial = factura(2, '2026-11', { estado: EstadoFactura.PARCIAL, pagado: 260000 });
  parcial.cuotas[0].estado = EstadoCuota.PAGADA;
  parcial.cuotas[1].estado = EstadoCuota.EN_REVISION;
  facturas.push(
    factura(1, '2026-11', { estado: EstadoFactura.PAGADA, pagado: 290000 }),
    parcial,
    factura(3, '2026-11'),
    factura(4, '2026-12'), // otro período
  );

  const r = await svc.ejecutarJobsDiarios('2026-11-20', deps());

  const [t] = r.tareas;
  assert.equal(t.tipo, 'DEUDA');
  assert.equal(t.facturas, 2);
  assert.deepEqual(
    mails.map((m) => m.para),
    ['padre102@mail.com', 'padre103@mail.com'],
  );
  const m = mails[0];
  assert.equal(m.asunto, 'Recordatorio de pago — Alumno 2 (Noviembre 2026)');
  assert.match(m.texto, /saldo pendiente de \$\s30\.000,00/);
  assert.match(m.texto, /Deporte: Fútbol — Martes 15:00 a 16:30 \(comprobante en revisión\)/);
  assert.doesNotMatch(m.texto, /Cuota mensual/); // ya pagada
  assert.match(m.texto, /está en revisión: no hace falta que vuelvas a pagarlo/);
  assert.doesNotMatch(mails[1].texto, /en revisión/);
});

test('deuda: una factura PARCIAL sin saldo (redondeo) no recibe aviso', async () => {
  facturas.push(factura(1, '2026-11', { estado: EstadoFactura.PARCIAL, pagado: 290000 }));
  const r = await svc.enviarAvisoDeuda('2026-11', deps());
  assert.equal(r.facturas, 0);
  assert.equal(mails.length, 0);
});
