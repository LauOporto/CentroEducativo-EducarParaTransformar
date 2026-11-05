import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { parseRangoFechas } from '../utils/fechas';
import { obtenerEstadoCuenta } from './pagos.facade';

// RF-49 (D9 + A5): estado de cuenta con Prisma en memoria. "Hoy" se fija en
// 2026-11-05 para que VENCIDA no dependa del día en que corre el test.
const HOY = '2026-11-05';
const D = (v: number) => new Prisma.Decimal(v);
const dia = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const ALUMNO = { id: 7, nombre: 'Franco Barrabino', curso: { nombre: '1° año', nivel: { nombre: 'Secundaria' } } };

let facturas: any[];
let pagos: any[];
let queries: string[];

const cuota = (id: number, concepto: string, importe: number, vencimiento: string, estado = 'PENDIENTE') => ({
  id,
  concepto,
  descripcion: concepto,
  importe: D(importe),
  vencimiento: dia(vencimiento),
  estado,
});

function factura(
  id: number,
  periodo: string,
  cuotas: any[],
  extras: Partial<{ estado: string; pagos: number[]; comprobantes: any[] }> = {},
) {
  const total = cuotas.reduce((acc, c) => acc.plus(c.importe), D(0));
  return {
    id,
    numero: `F-${periodo.replace('-', '')}-${String(id).padStart(6, '0')}`,
    estudianteId: 7,
    periodo,
    emitidaEn: new Date(`${periodo}-01T11:00:00.000Z`),
    vencimiento: dia(`${periodo}-10`),
    total,
    estado: extras.estado ?? 'PENDIENTE',
    cuotas,
    comprobantes: extras.comprobantes ?? [],
    pagos: (extras.pagos ?? []).map((m) => ({ monto: D(m) })),
  };
}

beforeEach(() => {
  queries = [];
  facturas = [
    // Septiembre: pagada con DOS pagos (dos comprobantes).
    factura(
      1,
      '2026-09',
      [cuota(1, 'CUOTA', 260000, '2026-09-10', 'PAGADA'), cuota(2, 'DEPORTE', 30000, '2026-09-10', 'PAGADA')],
      {
        estado: 'PAGADA',
        pagos: [260000, 30000],
        comprobantes: [
          {
            id: 1,
            numero: 'CP-202609-900071',
            total: D(260000),
            estado: 'APROBADO',
            nroOperacion: 'OP1',
            cargadoEn: new Date('2026-09-04T18:00:00Z'),
            motivoRechazo: null,
            archivoId: 'educar/comprobantes/x',
          },
          {
            id: 2,
            numero: 'CP-202609-900072',
            total: D(30000),
            estado: 'APROBADO',
            nroOperacion: 'OP2',
            cargadoEn: null,
            motivoRechazo: null,
            archivoId: null,
          },
        ],
      },
    ),
    // Octubre: CUOTA pagada; deporte vencido; transporte en revisión (no vence).
    factura(
      2,
      '2026-10',
      [
        cuota(3, 'CUOTA', 260000, '2026-10-10', 'PAGADA'),
        cuota(4, 'DEPORTE', 30000.5, '2026-10-10'),
        cuota(5, 'TRANSPORTE', 45000, '2026-10-10', 'EN_REVISION'),
        cuota(6, 'COMEDOR', 60000, '2026-10-10'),
      ],
      { estado: 'PARCIAL', pagos: [260000] },
    ),
    // Noviembre: pendiente, todavía no venció.
    factura(3, '2026-11', [cuota(7, 'CUOTA', 260000, '2026-11-10'), cuota(8, 'COMEDOR', 60000, '2026-11-10')]),
    // Marzo: fuera del rango por defecto.
    factura(4, '2026-03', [cuota(9, 'CUOTA', 250000, '2026-03-10')]),
  ];
  pagos = [
    {
      id: 1,
      fechaAcreditacion: new Date('2026-09-05T14:00:00Z'),
      monto: D(260000),
      comprobante: { numero: 'CP-202609-900071' },
      factura: { numero: 'F-202609-000001', periodo: '2026-09' },
    },
    {
      id: 2,
      fechaAcreditacion: new Date('2026-09-09T14:00:00Z'),
      monto: D(30000),
      comprobante: { numero: 'CP-202609-900072' },
      factura: { numero: 'F-202609-000001', periodo: '2026-09' },
    },
    {
      id: 3,
      fechaAcreditacion: new Date('2026-10-07T14:00:00Z'),
      monto: D(260000),
      comprobante: { numero: 'CP-202610-900071' },
      factura: { numero: 'F-202610-000002', periodo: '2026-10' },
    },
    {
      id: 4,
      fechaAcreditacion: new Date('2026-03-08T14:00:00Z'),
      monto: D(1),
      comprobante: { numero: 'CP-202603-900071' },
      factura: { numero: 'F-202603-000004', periodo: '2026-03' },
    },
  ];

  Object.defineProperty(prisma, 'factura', {
    configurable: true,
    value: {
      findMany: async ({ where, orderBy }: any) => {
        queries.push('factura.findMany');
        assert.deepEqual(orderBy, { periodo: 'desc' });
        return facturas
          .filter((f) => f.estudianteId === where.estudianteId)
          .filter((f) => f.vencimiento >= where.vencimiento.gte && f.vencimiento <= where.vencimiento.lte)
          .sort((a, b) => b.periodo.localeCompare(a.periodo));
      },
    },
  });
  Object.defineProperty(prisma, 'pago', {
    configurable: true,
    value: {
      findMany: async ({ where }: any) => {
        queries.push('pago.findMany');
        const { gte, lt } = where.fechaAcreditacion;
        return pagos.filter((p) => p.fechaAcreditacion >= gte && p.fechaAcreditacion < lt).reverse();
      },
    },
  });
  Object.defineProperty(prisma, 'user', {
    configurable: true,
    value: {
      findUnique: async () => {
        queries.push('user.findUnique');
        return ALUMNO;
      },
    },
  });
});

const estadoCuenta = (desde?: string, hasta?: string) =>
  obtenerEstadoCuenta(7, parseRangoFechas(desde, hasta, HOY), { alumno: ALUMNO, hoy: HOY });

test('rango por defecto (hoy − 6 meses a hoy + 2 meses): incluye la factura que todavía no venció', async () => {
  const r = await estadoCuenta();
  assert.deepEqual(r.rango, { desde: '2026-05-05', hasta: '2027-01-05' });
  assert.deepEqual(
    r.facturas.map((f) => f.periodo),
    ['2026-11', '2026-10', '2026-09'],
  );
  assert.deepEqual(r.alumno, { id: 7, nombre: 'Franco Barrabino', curso: 'Secundaria — 1° año' });
});

test('VENCIDA: ítem PENDIENTE con vencimiento anterior a hoy; EN_REVISION y los no vencidos no', async () => {
  const r = await estadoCuenta();
  const octubre = r.facturas.find((f) => f.periodo === '2026-10')!;
  assert.deepEqual(
    octubre.items.map((i) => [i.concepto, i.estado]),
    [
      ['CUOTA', 'PAGADA'],
      ['DEPORTE', 'VENCIDA'],
      ['TRANSPORTE', 'EN_REVISION'],
      ['COMEDOR', 'VENCIDA'],
    ],
  );
  const noviembre = r.facturas.find((f) => f.periodo === '2026-11')!;
  assert.deepEqual(
    noviembre.items.map((i) => i.estado),
    ['PENDIENTE', 'PENDIENTE'],
  );
});

test('el mismo ítem PENDIENTE vence justo al día siguiente de su vencimiento', async () => {
  const r = await obtenerEstadoCuenta(7, parseRangoFechas(undefined, undefined, '2026-11-10'), {
    alumno: ALUMNO,
    hoy: '2026-11-10',
  });
  assert.equal(r.facturas[0].items[0].estado, 'PENDIENTE');
  const r2 = await obtenerEstadoCuenta(7, parseRangoFechas(undefined, undefined, '2026-11-11'), {
    alumno: ALUMNO,
    hoy: '2026-11-11',
  });
  assert.equal(r2.facturas[0].items[0].estado, 'VENCIDA');
});

test('pagado y saldo por factura: dos pagos en la misma factura', async () => {
  const r = await estadoCuenta();
  const sept = r.facturas.find((f) => f.periodo === '2026-09')!;
  assert.deepEqual([sept.total, sept.pagado, sept.saldo, sept.estado], [290000, 290000, 0, 'PAGADA']);
  assert.equal(sept.comprobantes.length, 2);
  assert.deepEqual(
    sept.comprobantes.map((c) => [c.numero, c.estado, c.tieneArchivo]),
    [
      ['CP-202609-900071', 'APROBADO', true],
      ['CP-202609-900072', 'APROBADO', false],
    ],
  );
  const oct = r.facturas.find((f) => f.periodo === '2026-10')!;
  assert.deepEqual([oct.total, oct.pagado, oct.saldo], [395000.5, 260000, 135000.5]);
});

test('resumen: adeudado, vencido, en revisión, pagado y deuda por concepto (montos con 2 decimales)', async () => {
  const r = await estadoCuenta();
  assert.deepEqual(r.resumen, {
    totalAdeudado: 30000.5 + 45000 + 60000 + 260000 + 60000,
    totalVencido: 30000.5 + 60000,
    totalEnRevision: 45000,
    totalPagado: 290000 + 260000,
    deudaPorConcepto: { CUOTA: 260000, DEPORTE: 30000.5, TRANSPORTE: 45000, COMEDOR: 120000 },
  });
});

test('historial de pagos: solo los acreditados dentro del rango, con comprobante, factura y período', async () => {
  const r = await estadoCuenta();
  assert.deepEqual(
    r.pagos.map((p) => [p.monto, p.comprobanteNumero, p.facturaNumero, p.periodo]),
    [
      [260000, 'CP-202610-900071', 'F-202610-000002', '2026-10'],
      [30000, 'CP-202609-900072', 'F-202609-000001', '2026-09'],
      [260000, 'CP-202609-900071', 'F-202609-000001', '2026-09'],
    ],
  );
});

test('rango custom: solo octubre', async () => {
  const r = await estadoCuenta('2026-10-01', '2026-10-31');
  assert.deepEqual(
    r.facturas.map((f) => f.periodo),
    ['2026-10'],
  );
  assert.deepEqual(
    r.pagos.map((p) => p.comprobanteNumero),
    ['CP-202610-900071'],
  );
  assert.equal(r.resumen.totalPagado, 260000);
  assert.equal(r.resumen.deudaPorConcepto.CUOTA, 0);
});

test('un pago acreditado el último día del rango a las 23:30 de Argentina entra', async () => {
  pagos.push({
    id: 5,
    fechaAcreditacion: new Date('2026-11-01T02:30:00Z'), // 31/10 23:30 en Argentina
    monto: D(10),
    comprobante: { numero: 'CP-X' },
    factura: { numero: 'F-X', periodo: '2026-10' },
  });
  const r = await estadoCuenta('2026-10-01', '2026-10-31');
  assert.ok(r.pagos.some((p) => p.comprobanteNumero === 'CP-X'));
});

test('rango de más de 24 meses → 400 antes de consultar la base', async () => {
  assert.throws(
    () => parseRangoFechas('2024-01-01', '2026-07-01', HOY),
    (err) => err instanceof HttpError && err.status === 400,
  );
  assert.equal(queries.length, 0);
});

test('sin queries de más: con el alumno ya cargado, 2 consultas (facturas y pagos)', async () => {
  await estadoCuenta();
  assert.deepEqual(queries.sort(), ['factura.findMany', 'pago.findMany']);
});
