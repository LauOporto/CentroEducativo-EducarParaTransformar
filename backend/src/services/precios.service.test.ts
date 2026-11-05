import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { AccionAuditoria } from '@prisma/client';

import { HttpError } from '../utils/httpError';
import { toMonto } from '../utils/montos';
import { actualizarPrecio, parsePrecio, MSG_PRECIO_INVALIDO } from './precios.service';
import { generarFacturasPeriodo } from './facturacion.service';
import { crearBaseFacturacion } from './facturacion.fixture';

// Regla "solo el Administrador fija valores": validación del precio,
// auditoría y precio congelado en las facturas ya emitidas.
let base: ReturnType<typeof crearBaseFacturacion>;

beforeEach(() => {
  base = crearBaseFacturacion();
});

const precioInvalido = (err: unknown) =>
  err instanceof HttpError && err.status === 400 && err.message === MSG_PRECIO_INVALIDO;

test('parsePrecio acepta 0, enteros y hasta 2 decimales, en number o string', () => {
  assert.equal(parsePrecio(0).toFixed(2), '0.00');
  assert.equal(parsePrecio(25000).toFixed(2), '25000.00');
  assert.equal(parsePrecio('42500.5').toFixed(2), '42500.50');
  assert.equal(parsePrecio(10_000_000).toFixed(2), '10000000.00');
});

test('parsePrecio rechaza negativos, más de 2 decimales, más de 10.000.000 y valores no numéricos', () => {
  for (const malo of [-1, '-5', 10.123, '10.123', 10_000_000.01, 1e21, NaN, '', 'abc', null, undefined, {}]) {
    assert.throws(() => parsePrecio(malo), precioInvalido, String(malo));
  }
});

test('actualizarPrecio guarda el valor, lo devuelve como number y audita anterior → nuevo', async () => {
  const deporte = await actualizarPrecio('deporte', 1, 32500, 99);
  assert.deepEqual(deporte, { id: 1, nombre: 'Fútbol', precioMensual: 32500 });
  assert.equal(toMonto(base.db.deportes[0].precioMensual), 32500);
  assert.deepEqual(base.db.auditoria, [
    {
      usuarioId: 99,
      accion: AccionAuditoria.MODIFICACION,
      entidad: 'Deporte',
      entidadId: 1,
      detalle: 'precioMensual: 30000.00 → 32500.00',
    },
  ]);
});

test('actualizarPrecio de la cuota de un nivel usa el campo cuotaMensual', async () => {
  const nivel = await actualizarPrecio('nivel', 2, '270000', 99);
  assert.deepEqual(nivel, { id: 2, nombre: 'Secundaria', cuotaMensual: 270000 });
  assert.equal(base.db.auditoria[0].entidad, 'NivelEducativo');
});

test('actualizarPrecio de un recurso inexistente → 404 y no audita', async () => {
  for (const tipo of ['nivel', 'deporte', 'recorrido', 'turno'] as const) {
    await assert.rejects(
      actualizarPrecio(tipo, 999, 1000, 99),
      (err) => err instanceof HttpError && err.status === 404,
    );
  }
  assert.equal(base.db.auditoria.length, 0);
});

test('actualizarPrecio con un precio inválido → 400 y no cambia nada', async () => {
  await assert.rejects(actualizarPrecio('turno', 5, -100, 99), precioInvalido);
  assert.equal(toMonto(base.db.turnos[0].precioMensual), 60000);
});

test('cambiar un precio no modifica los importes de las facturas ya emitidas', async () => {
  base.agregarAlumno(7);
  base.db.inscDeporte.push({ estudianteId: 7, deporteId: 1, grupoDeporteId: 101 });
  await generarFacturasPeriodo('2026-10');
  const importeEmitido = () =>
    toMonto(base.db.cuotas.find((c) => c.concepto === 'DEPORTE' && c.facturaId === 1).importe);
  assert.equal(importeEmitido(), 30000);

  await actualizarPrecio('deporte', 1, 35000, 99);
  await actualizarPrecio('nivel', 2, 280000, 99);

  assert.equal(importeEmitido(), 30000, 'el ítem emitido conserva el precio viejo');
  assert.equal(toMonto(base.db.facturas[0].total), 290000, 'el total emitido tampoco cambia');

  // El precio nuevo rige para la factura siguiente.
  await generarFacturasPeriodo('2026-11');
  const nuevaDeporte = base.db.cuotas.find((c) => c.concepto === 'DEPORTE' && c.facturaId === 2);
  assert.equal(toMonto(nuevaDeporte.importe), 35000);
  assert.equal(toMonto(base.db.facturas[1].total), 315000);
});
