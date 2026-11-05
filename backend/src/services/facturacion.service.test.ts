import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EstadoAlumno, EstadoComprobante, Prisma, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { toMonto } from '../utils/montos';
import {
  MOTIVO_SIN_ITEMS,
  MOTIVO_YA_FACTURADO,
  estadoFacturaSegunPagos,
  generarFacturasPeriodo,
  recalcularEstadoFactura,
} from './facturacion.service';
import { crearBaseFacturacion } from './facturacion.fixture';

// D8 + A3 + A4 con Prisma en memoria (facturacion.fixture.ts).
let base: ReturnType<typeof crearBaseFacturacion>;

beforeEach(() => {
  base = crearBaseFacturacion();
});

// Alumno 7 de Secundaria con Fútbol, Vóley, transporte y comedor.
function alumnoCompleto(id = 7) {
  base.agregarAlumno(id);
  base.db.inscDeporte.push(
    { estudianteId: id, deporteId: 1, grupoDeporteId: 101 },
    { estudianteId: id, deporteId: 2, grupoDeporteId: 102 },
  );
  base.db.inscTransporte.push({ estudianteId: id, recorridoId: 4 });
  base.db.inscComedor.push({ estudianteId: id, turnoId: 5 });
}

const items = (facturaId: number) => base.db.cuotas.filter((c) => c.facturaId === facturaId);

test('arma un ítem por concepto, con referenciaId = grupoDeporteId en DEPORTE y descripción congelada', async () => {
  alumnoCompleto();
  const r = await generarFacturasPeriodo('2026-11');
  assert.deepEqual(r, { periodo: '2026-11', creadas: 1, omitidas: 0, detalleOmitidas: [] });

  assert.deepEqual(
    items(1).map((c) => [c.concepto, c.referenciaId, c.descripcion, toMonto(c.importe)]),
    [
      ['CUOTA', 0, 'Cuota mensual — Secundaria', 260000],
      ['DEPORTE', 101, 'Fútbol — Secundaria — Martes 15:00 a 16:30 — Prof. Andrés Martínez', 30000],
      ['DEPORTE', 102, 'Vóley — Secundaria — Miércoles 14:00 a 15:00 — Prof. Andrés Martínez', 28000],
      ['TRANSPORTE', 4, 'Recorrido Norte', 45000],
      ['COMEDOR', 5, 'Primer turno', 60000],
    ],
  );
  for (const c of items(1)) {
    assert.equal(c.estudianteId, 7);
    assert.equal(c.vencimiento.toISOString(), '2026-11-10T00:00:00.000Z');
  }
});

test('total = suma de los ítems; vencimiento el día 10 y número a partir del id', async () => {
  alumnoCompleto();
  await generarFacturasPeriodo('2026-11');
  const f = base.db.facturas[0];
  assert.equal(toMonto(f.total), 423000);
  assert.equal(f.vencimiento.toISOString(), '2026-11-10T00:00:00.000Z');
  assert.equal(f.numero, 'F-202611-000001');
  assert.equal(f.estudianteId, 7);
});

test('omite los ítems de importe 0', async () => {
  base.agregarAlumno(7);
  base.db.inscDeporte.push({ estudianteId: 7, deporteId: 3, grupoDeporteId: 103 }); // Ajedrez, $0
  await generarFacturasPeriodo('2026-11');
  assert.deepEqual(
    items(1).map((c) => c.concepto),
    ['CUOTA'],
  );
});

test('si al alumno no le queda ningún ítem, no se crea factura y se informa el motivo', async () => {
  base.db.niveles[1].cuotaMensual = new Prisma.Decimal(0);
  base.agregarAlumno(7);
  const r = await generarFacturasPeriodo('2026-11');
  assert.deepEqual(r, {
    periodo: '2026-11',
    creadas: 0,
    omitidas: 1,
    detalleOmitidas: [{ estudianteId: 7, motivo: MOTIVO_SIN_ITEMS }],
  });
  assert.equal(base.db.facturas.length, 0);
});

test('A3: no factura a quien no es ESTUDIANTE, está inactivo, no está ACTIVO o no tiene curso', async () => {
  base.agregarAlumno(1, { role: Role.PADRE });
  base.agregarAlumno(2, { isActive: false });
  base.agregarAlumno(3, { estado: EstadoAlumno.INACTIVO });
  base.agregarAlumno(4, { estado: EstadoAlumno.EGRESADO });
  base.agregarAlumno(5, { cursoId: null });
  base.agregarAlumno(6); // el único facturable
  const r = await generarFacturasPeriodo('2026-11');
  assert.equal(r.creadas, 1);
  assert.deepEqual(
    base.db.facturas.map((f) => f.estudianteId),
    [6],
  );
});

test('idempotente: la segunda corrida no crea ni modifica nada', async () => {
  alumnoCompleto(7);
  alumnoCompleto(8);
  await generarFacturasPeriodo('2026-11');
  const antes = JSON.stringify({ f: base.db.facturas, c: base.db.cuotas });

  base.db.deportes[0].precioMensual = new Prisma.Decimal(99999); // aunque cambie un precio
  const r = await generarFacturasPeriodo('2026-11');

  assert.deepEqual(r, {
    periodo: '2026-11',
    creadas: 0,
    omitidas: 2,
    detalleOmitidas: [
      { estudianteId: 7, motivo: MOTIVO_YA_FACTURADO },
      { estudianteId: 8, motivo: MOTIVO_YA_FACTURADO },
    ],
  });
  assert.equal(JSON.stringify({ f: base.db.facturas, c: base.db.cuotas }), antes);
});

test('otro período genera otra factura para el mismo alumno', async () => {
  alumnoCompleto();
  await generarFacturasPeriodo('2026-11');
  const r = await generarFacturasPeriodo('2026-12');
  assert.equal(r.creadas, 1);
  assert.equal(base.db.facturas[1].numero, 'F-202612-000002');
});

test('emisión simultánea: si la base rechaza el duplicado (P2002) el alumno cuenta como omitido', async () => {
  alumnoCompleto();
  // Otra emisión creó la factura entre la lectura y la escritura.
  const original = (prisma as any).factura.findMany;
  (prisma as any).factura.findMany = async () => [];
  base.db.facturas.push({ id: 50, estudianteId: 7, periodo: '2026-11', numero: 'F-202611-000050' });
  const r = await generarFacturasPeriodo('2026-11');
  (prisma as any).factura.findMany = original;
  assert.deepEqual(r.detalleOmitidas, [{ estudianteId: 7, motivo: MOTIVO_YA_FACTURADO }]);
  assert.equal(r.creadas, 0);
});

test('audita cada factura creada cuando la genera un usuario (ALTA, entidad Factura)', async () => {
  alumnoCompleto();
  await generarFacturasPeriodo('2026-11', { usuarioId: 99 });
  assert.deepEqual(base.db.auditoria, [
    { usuarioId: 99, accion: 'ALTA', entidad: 'Factura', entidadId: 1, detalle: 'F-202611-000001 — período 2026-11' },
  ]);
});

test('período inválido → 400', async () => {
  await assert.rejects(generarFacturasPeriodo('2026-13'), (err) => err instanceof HttpError && err.status === 400);
});

// ---- Estado de ítems y facturas ----

test('estado de la factura según lo pagado: PENDIENTE, PARCIAL, PAGADA', () => {
  const D = (v: number) => new Prisma.Decimal(v);
  assert.equal(estadoFacturaSegunPagos(D(1000), D(0)), 'PENDIENTE');
  assert.equal(estadoFacturaSegunPagos(D(1000), D(0.01)), 'PARCIAL');
  assert.equal(estadoFacturaSegunPagos(D(1000), D(1000)), 'PAGADA');
});

test('recalcularEstadoFactura: APROBADO → PAGADA, EN_REVISION → EN_REVISION, RECHAZADO libera el ítem', async () => {
  const D = (v: number) => new Prisma.Decimal(v);
  const cuotas = [
    { id: 1, estado: 'PENDIENTE' },
    { id: 2, estado: 'PENDIENTE' },
    { id: 3, estado: 'EN_REVISION' }, // su comprobante fue rechazado
  ];
  let estadoFactura = 'PENDIENTE';
  const tx = {
    factura: {
      findUnique: async () => ({
        total: D(300),
        estado: estadoFactura,
        cuotas,
        // findUnique ya filtra los activos (RECHAZADO y ANULADO no llegan).
        comprobantes: [
          { estado: EstadoComprobante.APROBADO, items: [{ cuotaId: 1 }] },
          { estado: EstadoComprobante.EN_REVISION, items: [{ cuotaId: 2 }] },
        ],
        pagos: [{ monto: D(100) }],
      }),
      update: async ({ data }: any) => (estadoFactura = data.estado),
    },
    cuota: {
      updateMany: async ({ where, data }: any) =>
        cuotas.filter((c) => where.id.in.includes(c.id)).forEach((c) => (c.estado = data.estado)),
    },
  } as unknown as Prisma.TransactionClient;

  const r = await recalcularEstadoFactura(1, tx);
  assert.deepEqual(
    cuotas.map((c) => c.estado),
    ['PAGADA', 'EN_REVISION', 'PENDIENTE'],
  );
  assert.equal(r.estado, 'PARCIAL');
  assert.equal(estadoFactura, 'PARCIAL');
});
