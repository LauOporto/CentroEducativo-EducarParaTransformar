import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Request } from 'express';
import PDFDocument from 'pdfkit';
import { Prisma, Role } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { HttpError } from '../../utils/httpError';
import { obtenerEstrategia, listarEstrategias } from './index';
import { ingresosPorPeriodoStrategy } from './ingresosPorPeriodo.strategy';
import { pagosCompletosPorPeriodoStrategy } from './pagosCompletosPorPeriodo.strategy';
import { pagosIncompletosPorPeriodoStrategy } from './pagosIncompletosPorPeriodo.strategy';
import { pagosPorDeporteStrategy } from './pagosPorDeporte.strategy';
import { pagosPorRecorridoStrategy } from './pagosPorRecorrido.strategy';
import { parseRangoObligatorio } from './financieros.helpers';

// Tests unitarios de los 5 reportes financieros (RF-52 y RF-53, D10):
// validaciones de rango y filtros, agrupación por año y por alumno,
// subtotales, totales y generación de PDF válido.

const D = (v: number) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
const reqQuery = (query: Record<string, string | undefined>) => ({ query }) as unknown as Request;

const ALUMNO_1 = {
  id: 6,
  nombre: 'Franco Barrabino',
  legajo: 'LEG-0001',
  role: Role.ESTUDIANTE,
  curso: { nombre: '1° año', nivel: { nombre: 'Secundaria' } },
};
const ALUMNO_2 = {
  id: 8,
  nombre: 'María Gómez',
  legajo: 'LEG-0003',
  role: Role.ESTUDIANTE,
  curso: { nombre: '6° grado', nivel: { nombre: 'Primaria' } },
};
const DOCENTE_1 = { id: 2, nombre: 'Andrés Martínez', role: Role.DOCENTE };

let mockUsers: any[];
let mockPagos: any[];
let mockFacturas: any[];
let mockCuotas: any[];
let mockNiveles: any[];
let mockDeportes: any[];
let mockGruposDeporte: any[];
let mockRecorridos: any[];

beforeEach(() => {
  mockUsers = [ALUMNO_1, ALUMNO_2, DOCENTE_1];
  mockNiveles = [
    { id: 1, nombre: 'Primaria' },
    { id: 2, nombre: 'Secundaria' },
  ];
  mockDeportes = [
    { id: 10, nombre: 'Fútbol' },
    { id: 11, nombre: 'Básquet' },
  ];
  mockGruposDeporte = [
    {
      id: 100,
      deporteId: 10,
      nivelId: 2,
      diaSemana: 'MARTES',
      horaInicio: hora('15:00'),
      horaFin: hora('16:30'),
      docenteId: 2,
      deporte: { id: 10, nombre: 'Fútbol' },
      nivel: { id: 2, nombre: 'Secundaria' },
      docente: DOCENTE_1,
    },
  ];
  mockRecorridos = [
    { id: 20, nombre: 'Recorrido Norte', horaSalida: hora('07:00'), horaRegreso: hora('17:30') },
    { id: 21, nombre: 'Recorrido Este', horaSalida: hora('07:20'), horaRegreso: hora('17:50') },
  ];

  mockPagos = [
    {
      id: 1,
      estudianteId: 6,
      estudiante: ALUMNO_1,
      monto: D(260000),
      fechaAcreditacion: new Date('2026-09-06T14:00:00.000Z'),
      comprobante: { numero: 'CP-202609-900061' },
      factura: { numero: 'F-202609-000001', periodo: '2026-09' },
    },
    {
      id: 2,
      estudianteId: 6,
      estudiante: ALUMNO_1,
      monto: D(155000),
      fechaAcreditacion: new Date('2026-10-07T14:00:00.000Z'),
      comprobante: { numero: 'CP-202610-900061' },
      factura: { numero: 'F-202610-000002', periodo: '2026-10' },
    },
    {
      id: 3,
      estudianteId: 8,
      estudiante: ALUMNO_2,
      monto: D(220000),
      fechaAcreditacion: new Date('2025-12-05T14:00:00.000Z'),
      comprobante: { numero: 'CP-202512-900081' },
      factura: { numero: 'F-202512-000009', periodo: '2025-12' },
    },
  ];

  mockFacturas = [
    {
      id: 1,
      numero: 'F-202609-000001',
      estudianteId: 6,
      estudiante: ALUMNO_1,
      periodo: '2026-09',
      vencimiento: dia('2026-09-10'),
      total: D(415000),
      estado: 'PAGADA',
      pagos: [{ monto: D(415000) }],
    },
    {
      id: 2,
      numero: 'F-202610-000002',
      estudianteId: 6,
      estudiante: ALUMNO_1,
      periodo: '2026-10',
      vencimiento: dia('2026-10-10'),
      total: D(415000),
      estado: 'PARCIAL',
      pagos: [{ monto: D(260000) }],
    },
    {
      id: 3,
      numero: 'F-202611-000003',
      estudianteId: 8,
      estudiante: ALUMNO_2,
      periodo: '2026-11',
      vencimiento: dia('2026-11-10'),
      total: D(250000),
      estado: 'PENDIENTE',
      pagos: [],
    },
  ];

  mockCuotas = [
    {
      id: 50,
      concepto: 'DEPORTE',
      referenciaId: 100,
      descripcion: 'Fútbol — Secundaria — Martes 15:00 a 16:30 — Prof. Andrés Martínez',
      importe: D(32000),
      vencimiento: dia('2026-09-10'),
      estado: 'PAGADA',
      estudianteId: 6,
      estudiante: ALUMNO_1,
      factura: { periodo: '2026-09' },
      itemsComprobante: [{ comprobante: { pago: { fechaAcreditacion: new Date('2026-09-06T14:00:00.000Z') } } }],
    },
    {
      id: 51,
      concepto: 'DEPORTE',
      referenciaId: 100,
      descripcion: 'Fútbol — Secundaria — Martes 15:00 a 16:30 — Prof. Andrés Martínez',
      importe: D(32000),
      vencimiento: dia('2026-10-10'),
      estado: 'PENDIENTE',
      estudianteId: 6,
      estudiante: ALUMNO_1,
      factura: { periodo: '2026-10' },
      itemsComprobante: [],
    },
    {
      id: 60,
      concepto: 'TRANSPORTE',
      referenciaId: 20,
      descripcion: 'Recorrido Norte',
      importe: D(35000),
      vencimiento: dia('2026-09-10'),
      estado: 'PAGADA',
      estudianteId: 6,
      estudiante: ALUMNO_1,
      factura: { periodo: '2026-09' },
      itemsComprobante: [{ comprobante: { pago: { fechaAcreditacion: new Date('2026-09-06T14:00:00.000Z') } } }],
    },
    {
      id: 61,
      concepto: 'TRANSPORTE',
      referenciaId: 21,
      descripcion: 'Recorrido Este',
      importe: D(48000),
      vencimiento: dia('2026-10-10'),
      estado: 'PENDIENTE',
      estudianteId: 8,
      estudiante: ALUMNO_2,
      factura: { periodo: '2026-10' },
      itemsComprobante: [],
    },
  ];

  Object.defineProperty(prisma, 'user', {
    configurable: true,
    value: {
      findFirst: async ({ where }: any) =>
        mockUsers.find((u) => u.id === where.id && (!where.role || u.role === where.role)) ?? null,
    },
  });
  Object.defineProperty(prisma, 'pago', {
    configurable: true,
    value: {
      findMany: async ({ where }: any) =>
        mockPagos.filter(
          (p) =>
            (!where.estudianteId || p.estudianteId === where.estudianteId) &&
            p.fechaAcreditacion >= where.fechaAcreditacion.gte &&
            p.fechaAcreditacion < where.fechaAcreditacion.lt,
        ),
    },
  });
  Object.defineProperty(prisma, 'factura', {
    configurable: true,
    value: {
      findMany: async ({ where }: any) =>
        mockFacturas.filter((f) => {
          const estadoOk =
            typeof where.estado === 'string' ? f.estado === where.estado : where.estado.in.includes(f.estado);
          const alumnoOk = !where.estudianteId || f.estudianteId === where.estudianteId;
          const fechaOk = f.vencimiento >= where.vencimiento.gte && f.vencimiento <= where.vencimiento.lte;
          return estadoOk && alumnoOk && fechaOk;
        }),
    },
  });
  Object.defineProperty(prisma, 'cuota', {
    configurable: true,
    value: {
      findMany: async ({ where }: any) =>
        mockCuotas.filter(
          (c) =>
            c.concepto === where.concepto &&
            (!where.referenciaId || c.referenciaId === where.referenciaId) &&
            (!where.estudianteId || c.estudianteId === where.estudianteId) &&
            c.vencimiento >= where.vencimiento.gte &&
            c.vencimiento <= where.vencimiento.lte,
        ),
    },
  });
  Object.defineProperty(prisma, 'nivelEducativo', {
    configurable: true,
    value: { findUnique: async ({ where }: any) => mockNiveles.find((n) => n.id === where.id) ?? null },
  });
  Object.defineProperty(prisma, 'deporte', {
    configurable: true,
    value: { findUnique: async ({ where }: any) => mockDeportes.find((d) => d.id === where.id) ?? null },
  });
  Object.defineProperty(prisma, 'grupoDeporte', {
    configurable: true,
    value: {
      findMany: async ({ where }: any) => mockGruposDeporte.filter((g) => where.id.in.includes(g.id)),
    },
  });
  Object.defineProperty(prisma, 'recorridoTransporte', {
    configurable: true,
    value: {
      findUnique: async ({ where }: any) => mockRecorridos.find((r) => r.id === where.id) ?? null,
      findMany: async ({ where }: any) => mockRecorridos.filter((r) => where.id.in.includes(r.id)),
    },
  });
});

test('las 5 estrategias financieras están registradas en el motor y autorizadas solo para ADMIN', () => {
  const claves = [
    'ingresos-por-periodo',
    'pagos-completos-por-periodo',
    'pagos-incompletos-por-periodo',
    'pagos-por-deporte',
    'pagos-por-recorrido',
  ];
  const registradas = listarEstrategias().map((e) => e.key);
  for (const key of claves) {
    assert.ok(registradas.includes(key), `Falta registrar ${key}`);
    const e = obtenerEstrategia(key)!;
    assert.deepEqual(e.rolesAutorizados, [Role.ADMIN]);
  }
});

test('parseRangoObligatorio valida presencia, formato, orden y máximo de 24 meses', () => {
  assert.throws(
    () => parseRangoObligatorio(reqQuery({})),
    (err) => err instanceof HttpError && err.status === 400,
  );
  assert.throws(
    () => parseRangoObligatorio(reqQuery({ desde: '2026-99-01', hasta: '2026-10-01' })),
    (err) => err instanceof HttpError && err.status === 400,
  );
  assert.throws(
    () => parseRangoObligatorio(reqQuery({ desde: '2026-11-01', hasta: '2026-09-01' })),
    (err) => err instanceof HttpError && err.status === 400,
  );
  assert.throws(
    () => parseRangoObligatorio(reqQuery({ desde: '2024-01-01', hasta: '2026-06-01' })),
    (err) => err instanceof HttpError && err.status === 400,
  );
});

test('Listado 1 (ingresos-por-periodo): agrupa pagos por año y por alumno y calcula subtotales y total', async () => {
  const params = await ingresosPorPeriodoStrategy.parseParams(reqQuery({ desde: '2025-11-01', hasta: '2026-11-30' }));
  const data = await ingresosPorPeriodoStrategy.obtenerDatos(params);

  assert.equal(data.totalGeneral, 220000 + 260000 + 155000);
  assert.deepEqual(
    data.anios.map((a) => [a.anio, a.subtotal]),
    [
      ['2025', 220000],
      ['2026', 415000],
    ],
  );
  assert.equal(data.anios[1].alumnos[0].alumno, 'Franco Barrabino');
  assert.equal(data.anios[1].alumnos[0].pagos.length, 2);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const chunks: Buffer[] = [];
  doc.on('data', (c: Buffer) => chunks.push(c));
  const fin = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
  ingresosPorPeriodoStrategy.renderPdf(doc, data);
  doc.end();
  const pdf = await fin;
  assert.equal(pdf.subarray(0, 4).toString('latin1'), '%PDF');
});

test('Listado 2 (pagos-completos-por-periodo): incluye solo facturas PAGADA dentro del rango', async () => {
  const params = await pagosCompletosPorPeriodoStrategy.parseParams(
    reqQuery({ desde: '2026-09-01', hasta: '2026-11-30' }),
  );
  const data = await pagosCompletosPorPeriodoStrategy.obtenerDatos(params);

  assert.equal(data.totalGeneral, 415000);
  assert.equal(data.anios.length, 1);
  assert.equal(data.anios[0].anio, '2026');
  assert.equal(data.anios[0].alumnos[0].facturas[0].facturaNumero, 'F-202609-000001');
});

test('Listado 3 (pagos-incompletos-por-periodo): incluye PENDIENTE y PARCIAL con total, pagado y saldo', async () => {
  const params = await pagosIncompletosPorPeriodoStrategy.parseParams(
    reqQuery({ desde: '2026-09-01', hasta: '2026-11-30' }),
  );
  const data = await pagosIncompletosPorPeriodoStrategy.obtenerDatos(params);

  assert.equal(data.totalFacturado, 415000 + 250000);
  assert.equal(data.totalPagado, 260000);
  assert.equal(data.totalSaldo, 155000 + 250000);
  assert.equal(data.anios[0].alumnos.length, 2);
});

test('Listado 4 (pagos-por-deporte): reutiliza filtros de RF-32 + profesor y detalla estado y fecha de pago', async () => {
  const params = await pagosPorDeporteStrategy.parseParams(
    reqQuery({ desde: '2026-09-01', hasta: '2026-11-30', deporteId: '10', nivelId: '2', docenteId: '2' }),
  );
  const data = await pagosPorDeporteStrategy.obtenerDatos(params);

  assert.equal(data.filas.length, 2);
  assert.equal(data.totalFacturado, 64000);
  assert.equal(data.totalCobrado, 32000);
  assert.equal(data.filas[0].profesor, 'Andrés Martínez');
  assert.equal(data.filas[0].fechaPago, '2026-09-06');
  assert.equal(data.filas[1].fechaPago, null);
});

test('Listado 5 (pagos-por-recorrido): filtra por recorridoId y calcula facturado y cobrado', async () => {
  const params = await pagosPorRecorridoStrategy.parseParams(
    reqQuery({ desde: '2026-09-01', hasta: '2026-11-30', recorridoId: '20' }),
  );
  const data = await pagosPorRecorridoStrategy.obtenerDatos(params);

  assert.equal(data.filas.length, 1);
  assert.equal(data.filas[0].recorrido, 'Recorrido Norte');
  assert.equal(data.totalFacturado, 35000);
  assert.equal(data.totalCobrado, 35000);
});

test('filtro por alumno o recurso inexistente devuelve 404', async () => {
  const params = await ingresosPorPeriodoStrategy.parseParams(
    reqQuery({ desde: '2026-09-01', hasta: '2026-11-30', estudianteId: '999' }),
  );
  await assert.rejects(
    () => ingresosPorPeriodoStrategy.obtenerDatos(params),
    (err) => err instanceof HttpError && err.status === 404,
  );
});

test('resumenPorCurso: corte por año escolar con cantidad de alumnos y subtotal', async () => {
  const { resumenPorCurso, porCursoYAlumno, SIN_CURSO } = await import('./financieros.helpers');
  const alumnos = [
    { alumno: 'Zoe', curso: 'Secundaria — 2° año', subtotal: 100.1 },
    { alumno: 'Ana', curso: 'Secundaria — 10° año', subtotal: 50 },
    { alumno: 'Juan', curso: 'Secundaria — 2° año', subtotal: 200.2 },
    { alumno: 'Luz', curso: null, subtotal: 10 },
  ];
  assert.deepEqual(
    resumenPorCurso(alumnos, (a) => a.subtotal),
    [
      { curso: 'Secundaria — 2° año', alumnos: 2, subtotal: 300.3 },
      { curso: 'Secundaria — 10° año', alumnos: 1, subtotal: 50 },
      { curso: SIN_CURSO, alumnos: 1, subtotal: 10 },
    ],
  );
  assert.deepEqual(
    [...alumnos].sort(porCursoYAlumno).map((a) => a.alumno),
    ['Juan', 'Zoe', 'Ana', 'Luz'],
  );
});
