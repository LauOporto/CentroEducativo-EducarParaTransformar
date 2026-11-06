import { test, before, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ConceptoCuota, Role } from '@prisma/client';
import { ZodError } from 'zod';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';
import {
  ADMIN,
  ADMIN_ACTOR,
  ALUMNO_OTRO,
  DOCENTE,
  JPG_MINIMO,
  PADRE_ACTOR,
  PADRE_AJENO,
  PADRE_EMAIL,
  PADRE_INTERNA,
  PDF_MINIMO,
  PNG_1X1,
  actor,
  crearBaseComprobantes,
} from './comprobantes.fixture';

// RF-50 (D5 + D6 + D7) con Prisma en memoria. comprobantes.service importa
// config/env (vía almacenamiento y facturaPdf), que valida el entorno al
// cargarse: en CI no hay backend/.env, así que se cargan valores de prueba
// antes del import dinámico. Con NODE_ENV=test el almacenamiento es el
// driver en memoria (no toca red ni disco).
let svc: typeof import('./comprobantes.service');
let alm: typeof import('./almacenamiento');

const HOY = '2026-11-05';

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
  process.env.JWT_ACCESS_SECRET ??= 'a'.repeat(32);
  process.env.JWT_REFRESH_SECRET ??= 'b'.repeat(32);
  process.env.CLOUDINARY_CLOUD_NAME ??= 'test';
  process.env.CLOUDINARY_API_KEY ??= 'test';
  process.env.CLOUDINARY_API_SECRET ??= 'test';
  svc = await import('./comprobantes.service');
  alm = await import('./almacenamiento');
});

let base: Awaited<ReturnType<typeof crearBaseComprobantes>>;

beforeEach(async () => {
  mock.restoreAll();
  // NotificacionEmail y NotificacionInterna dejan traza por logger.info.
  mock.method(logger, 'info', () => {});
  base = await crearBaseComprobantes();
  alm.archivosEnMemoria.clear();
});

const nov = () => base.factura('2026-11');
const item = (facturaId: number, concepto: ConceptoCuota, n = 0) =>
  base.items(facturaId).filter((c) => c.concepto === concepto)[n];

const httpError = (status: number, mensaje?: string | RegExp) => (err: unknown) => {
  assert.ok(err instanceof HttpError, `se esperaba HttpError y llegó ${String(err)}`);
  assert.equal(err.status, status, err.message);
  if (typeof mensaje === 'string') assert.equal(err.message, mensaje);
  else if (mensaje) assert.match(err.message, mensaje);
  return true;
};

// CUOTA (260.000) + Fútbol (30.000) de noviembre = 290.000.
async function generarCuotaYFutbol() {
  const f = nov();
  const ids = [item(f.id, 'CUOTA').id, item(f.id, 'DEPORTE').id];
  const r = await svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id, cuotaIds: ids });
  return { f, ids, r, id: r.comprobante.id };
}

const camposOk = (extra: Record<string, string> = {}) => ({
  nroOperacion: 'OP-123456',
  fechaTransferencia: '2026-11-04',
  montoTransferido: '290000',
  ...extra,
});
const png = { buffer: PNG_1X1, mimetype: 'image/png' };

async function cargar(id: number, extra: Record<string, string> = {}, archivo = png) {
  return svc.cargarTransferencia(PADRE_ACTOR, id, camposOk(extra), archivo, { hoy: HOY });
}

// ---- Generar ----

test('generar: crea el comprobante GENERADO con total, número CP-AAAAMM-000000 e ítems EN_REVISION', async () => {
  const { f, ids, r, id } = await generarCuotaYFutbol();
  const c = r.comprobante;
  assert.equal(c.estado, 'GENERADO');
  assert.equal(c.total, 290000);
  assert.equal(c.numero, `CP-202611-${String(id).padStart(6, '0')}`);
  assert.deepEqual(
    c.items.map((i) => [i.cuotaId, i.concepto, i.importe]),
    [
      [ids[0], 'CUOTA', 260000],
      [ids[1], 'DEPORTE', 30000],
    ],
  );
  assert.deepEqual(c.factura, {
    id: f.id,
    numero: f.numero,
    periodo: '2026-11',
    vencimiento: '2026-11-10',
    estado: 'PENDIENTE',
  });
  assert.equal(c.alumno.nombre, 'Franco Alumno');
  for (const it of base.items(f.id)) {
    assert.equal(it.estado, ids.includes(it.id) ? 'EN_REVISION' : 'PENDIENTE', it.descripcion);
  }
  assert.equal(r.datosBancarios.alias, 'EDUCAR.TRANSFORMAR.CUOTAS');
  assert.match(r.instrucciones, /^Transferí exactamente \$\s290\.000,00 e indicá el N\.º de comprobante CP-202611-/);
  // snapshot del importe en cada ítem del comprobante
  assert.deepEqual(
    base.db.cpItems.map((i) => Number(i.importe)),
    [260000, 30000],
  );
  assert.equal(base.db.auditoria.length, 1);
  assert.equal(base.db.auditoria[0].accion, 'ALTA');
  assert.equal(base.db.auditoria[0].entidad, 'ComprobantePago');
  // no expone el archivo
  assert.equal('archivoId' in c, false);
});

test('generar: lista vacía o con repetidos → 400', async () => {
  const f = nov();
  await assert.rejects(svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id, cuotaIds: [] }), httpError(400));
  const id = item(f.id, 'CUOTA').id;
  await assert.rejects(
    svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id, cuotaIds: [id, id] }),
    httpError(400, /repetidos/),
  );
  await assert.rejects(svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id }), ZodError);
  assert.equal(base.db.comprobantes.length, 0);
});

test('generar: un ítem de otra factura → 400', async () => {
  const f = nov();
  const oct = base.factura('2026-10');
  await assert.rejects(
    svc.generarComprobante(PADRE_ACTOR, {
      facturaId: f.id,
      cuotaIds: [item(f.id, 'CUOTA').id, item(oct.id, 'CUOTA').id],
    }),
    httpError(400, /no pertenece a la factura/),
  );
  await assert.rejects(
    svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id, cuotaIds: [99999] }),
    httpError(400, /no pertenece/),
  );
  assert.equal(base.db.comprobantes.length, 0);
});

test('generar: un ítem EN_REVISION o PAGADO → 409 nombrando el ítem', async () => {
  const f = nov();
  const transporte = item(f.id, 'TRANSPORTE');
  const comedor = item(f.id, 'COMEDOR');
  transporte.estado = 'EN_REVISION';
  comedor.estado = 'PAGADA';
  await assert.rejects(
    svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id, cuotaIds: [transporte.id] }),
    httpError(409, `El ítem "${transporte.descripcion}" ya está incluido en otro comprobante.`),
  );
  await assert.rejects(
    svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id, cuotaIds: [comedor.id] }),
    httpError(409, `El ítem "${comedor.descripcion}" ya está pagado.`),
  );
});

test('generar: si el compare-and-set marca menos ítems → 409 y no queda comprobante ni ítems tocados', async () => {
  const f = nov();
  const [a, b] = [item(f.id, 'CUOTA'), item(f.id, 'COMEDOR')];
  // Lectura "vieja": ambos PENDIENTES; mientras tanto otro comprobante tomó b.
  const lectura = [{ ...a }, { ...b }];
  b.estado = 'EN_REVISION';
  const cuotaModel = (prisma as any).cuota;
  Object.defineProperty(prisma, 'cuota', {
    configurable: true,
    value: { ...cuotaModel, findMany: async () => lectura },
  });
  await assert.rejects(
    svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id, cuotaIds: [a.id, b.id] }),
    httpError(409, svc.MSG_ITEMS_OCUPADOS),
  );
  assert.equal(base.db.comprobantes.length, 0);
  assert.equal(base.db.cpItems.length, 0);
  assert.equal(item(f.id, 'CUOTA').estado, 'PENDIENTE'); // rollback del updateMany parcial
  assert.equal(base.db.auditoria.length, 0);
});

test('generar: padre no vinculado, ADMIN y DOCENTE → 403', async () => {
  const f = nov();
  const datos = { facturaId: f.id, cuotaIds: [item(f.id, 'CUOTA').id] };
  await assert.rejects(
    svc.generarComprobante(actor(PADRE_AJENO, Role.PADRE), datos),
    httpError(403, /no está vinculado/),
  );
  await assert.rejects(svc.generarComprobante(ADMIN_ACTOR, datos), httpError(403, svc.MSG_SOLO_PADRE_GENERA));
  await assert.rejects(svc.generarComprobante(ADMIN_ACTOR, {}), httpError(403, svc.MSG_SOLO_PADRE_GENERA));
  await assert.rejects(svc.generarComprobante(actor(DOCENTE, Role.DOCENTE), datos), httpError(403));
  assert.equal(base.db.comprobantes.length, 0);
});

// ---- Detalle ----

test('detalle: padre vinculado y ADMIN lo ven; padre ajeno y DOCENTE → 403', async () => {
  const { id } = await generarCuotaYFutbol();
  const r = await svc.obtenerComprobante(actor(PADRE_INTERNA, Role.PADRE), id);
  assert.equal(r.comprobante.id, id);
  assert.equal(r.comprobante.transferencia, null);
  assert.equal(r.comprobante.tieneArchivo, false);
  assert.equal((await svc.obtenerComprobante(ADMIN_ACTOR, id)).comprobante.id, id);
  await assert.rejects(svc.obtenerComprobante(actor(PADRE_AJENO, Role.PADRE), id), httpError(403));
  await assert.rejects(svc.obtenerComprobante(actor(DOCENTE, Role.DOCENTE), id), httpError(403));
  await assert.rejects(svc.obtenerComprobante(ADMIN_ACTOR, 999), httpError(404));
});

// ---- Transferencia ----

test('transferencia: medio EFECTIVO (o cualquier otro) → 400 con el texto exacto', async () => {
  const { id } = await generarCuotaYFutbol();
  for (const medio of ['EFECTIVO', 'efectivo', 'CASH', 'tarjeta']) {
    await assert.rejects(cargar(id, { medio }), httpError(400, 'Solo se aceptan pagos por transferencia bancaria.'));
  }
  assert.equal((await cargar(id, { medio: 'transferencia' })).comprobante.estado, 'EN_REVISION');
});

test('transferencia: monto distinto del total → 422 con el total esperado', async () => {
  const { id } = await generarCuotaYFutbol();
  for (const monto of ['289999.99', '290000.01', '29000']) {
    await assert.rejects(cargar(id, { montoTransferido: monto }), (err: unknown) => {
      httpError(422, /^El monto transferido debe ser exactamente \$\s290\.000,00\.$/)(err);
      assert.deepEqual((err as HttpError).details, { totalEsperado: 290000 });
      return true;
    });
  }
  await assert.rejects(cargar(id, { montoTransferido: '290000.123' }), httpError(400, /inválido/));
  await assert.rejects(cargar(id, { montoTransferido: 'abc' }), httpError(400, /inválido/));
  // Con decimales o coma decimal, si coincide, pasa.
  assert.equal((await cargar(id, { montoTransferido: '290000,00' })).comprobante.estado, 'EN_REVISION');
});

test('transferencia: si el comprobante no está GENERADO → 409', async () => {
  const { id } = await generarCuotaYFutbol();
  await cargar(id);
  await assert.rejects(cargar(id), httpError(409, svc.MSG_TRANSFERENCIA_NO_ADMITIDA));
  base.db.comprobantes[0].estado = 'ANULADO';
  await assert.rejects(cargar(id), httpError(409));
});

test('transferencia: magic bytes que no coinciden con el tipo declarado → 400', async () => {
  const { id } = await generarCuotaYFutbol();
  const casos = [
    { buffer: Buffer.from('esto es un txt renombrado'), mimetype: 'image/png' },
    { buffer: PNG_1X1, mimetype: 'application/pdf' },
    { buffer: PDF_MINIMO, mimetype: 'image/jpeg' },
    { buffer: PNG_1X1, mimetype: 'image/gif' },
  ];
  for (const archivo of casos) {
    await assert.rejects(cargar(id, {}, archivo), httpError(400, 'El archivo debe ser una imagen JPG/PNG o un PDF.'));
  }
  await assert.rejects(
    svc.cargarTransferencia(PADRE_ACTOR, id, camposOk(), undefined, { hoy: HOY }),
    httpError(400, /Adjuntá/),
  );
  assert.equal(alm.archivosEnMemoria.size, 0);
  assert.equal(base.db.comprobantes[0].estado, 'GENERADO');
});

test('detectarTipoArchivo: JPG, PNG y PDF por su firma', () => {
  assert.equal(svc.detectarTipoArchivo(JPG_MINIMO), 'image/jpeg');
  assert.equal(svc.detectarTipoArchivo(PNG_1X1), 'image/png');
  assert.equal(svc.detectarTipoArchivo(PDF_MINIMO), 'application/pdf');
  assert.equal(svc.detectarTipoArchivo(Buffer.from('GIF89a')), null);
  assert.equal(svc.detectarTipoArchivo(Buffer.alloc(0)), null);
});

test('transferencia: fecha futura, de hace más de 60 días o inválida → 400; nroOperacion inválido → 400', async () => {
  const { id } = await generarCuotaYFutbol();
  await assert.rejects(cargar(id, { fechaTransferencia: '2026-11-06' }), httpError(400, /futura/));
  await assert.rejects(cargar(id, { fechaTransferencia: '2026-09-05' }), httpError(400, /60 días/));
  await assert.rejects(cargar(id, { fechaTransferencia: '2026-02-30' }), httpError(400, /inválida/));
  for (const nro of ['123', 'a'.repeat(41), 'OP 1234', 'OP_1234']) {
    await assert.rejects(cargar(id, { nroOperacion: nro }), httpError(400, /N\.º de operación/));
  }
  // Justo 60 días atrás todavía vale.
  assert.equal((await cargar(id, { fechaTransferencia: '2026-09-06' })).comprobante.estado, 'EN_REVISION');
});

test('transferencia: caso feliz → EN_REVISION con datos y archivo, y aviso a cada ADMIN activo', async () => {
  const { id, r } = await generarCuotaYFutbol();
  const res = await cargar(id, {}, { buffer: PDF_MINIMO, mimetype: 'application/pdf' });
  const c = res.comprobante;
  assert.equal(c.estado, 'EN_REVISION');
  assert.equal(c.tieneArchivo, true);
  assert.deepEqual(
    { ...c.transferencia, cargadoEn: undefined },
    {
      nroOperacion: 'OP-123456',
      fechaTransferencia: '2026-11-04',
      montoTransferido: 290000,
      cargadoEn: undefined,
    },
  );
  const fila = base.db.comprobantes[0];
  assert.equal(fila.archivoTipo, 'application/pdf');
  assert.ok(alm.archivosEnMemoria.has(fila.archivoId));

  assert.deepEqual(
    base.db.notificaciones.map((n) => [n.userId, n.titulo, n.link]),
    [[ADMIN, 'Nuevo comprobante para revisar', '/admin/pagos']],
  );
  // Comparación de texto (no RegExp armada con datos): formatearPesos usa un
  // espacio duro entre "$" y el número, por eso se normalizan los espacios.
  const contenido = base.db.notificaciones[0].contenido.replace(/\s/g, ' ');
  const esperado = `${r.comprobante.numero} — Franco Alumno — $ 290.000,00`;
  assert.ok(contenido.includes(esperado), contenido);
  const audit = base.db.auditoria.at(-1);
  assert.equal(audit.accion, 'MODIFICACION');
  assert.match(audit.detalle, /transferencia cargada/);
});

test('transferencia: si falla la transacción, se borra el archivo ya subido', async () => {
  const { id } = await generarCuotaYFutbol();
  const eliminar = mock.method(alm.almacenamiento, 'eliminar');
  const cpModel = (prisma as any).comprobantePago;
  // Otro request cargó la transferencia entre la lectura y el compare-and-set.
  Object.defineProperty(prisma, 'comprobantePago', {
    configurable: true,
    value: { ...cpModel, updateMany: async () => ({ count: 0 }) },
  });
  await assert.rejects(cargar(id), httpError(409));
  assert.equal(eliminar.mock.callCount(), 1);
  const [archivoId, tipo] = eliminar.mock.calls[0].arguments;
  assert.match(archivoId, /^memoria\//);
  assert.equal(tipo, 'image/png');
  assert.equal(alm.archivosEnMemoria.has(archivoId), false);
  assert.equal(base.db.notificaciones.length, 0);
});

test('transferencia: padre ajeno y ADMIN → 403', async () => {
  const { id } = await generarCuotaYFutbol();
  await assert.rejects(
    svc.cargarTransferencia(actor(PADRE_AJENO, Role.PADRE), id, camposOk(), png, { hoy: HOY }),
    httpError(403),
  );
  await assert.rejects(
    svc.cargarTransferencia(ADMIN_ACTOR, id, camposOk(), png, { hoy: HOY }),
    httpError(403, svc.MSG_SOLO_PADRE_TRANSFERENCIA),
  );
});

// ---- Archivo ----

test('archivo: padre vinculado y ADMIN obtienen URL temporal; padre ajeno → 403; sin archivo → 404', async () => {
  const { id } = await generarCuotaYFutbol();
  await assert.rejects(svc.urlArchivoComprobante(PADRE_ACTOR, id, 'http://x'), httpError(404, svc.MSG_SIN_ARCHIVO));
  await cargar(id);
  const u = await svc.urlArchivoComprobante(PADRE_ACTOR, id, 'http://x');
  assert.match(u.url, /^http:\/\/x\/memoria\//);
  assert.ok(new Date(u.expiraEn).getTime() > Date.now());
  assert.ok(await svc.urlArchivoComprobante(ADMIN_ACTOR, id, 'http://x'));
  await assert.rejects(svc.urlArchivoComprobante(actor(PADRE_AJENO, Role.PADRE), id, 'http://x'), httpError(403));
});

// ---- Anular ----

test('anular: GENERADO → ANULADO y los ítems vuelven a PENDIENTE', async () => {
  const { f, id } = await generarCuotaYFutbol();
  const r = await svc.anularComprobante(PADRE_ACTOR, id);
  assert.equal(r.comprobante.estado, 'ANULADO');
  assert.ok(base.items(f.id).every((i) => i.estado === 'PENDIENTE'));
  assert.equal(base.db.auditoria.at(-1).detalle, `${r.comprobante.numero} — anulado`);
  // Los ítems quedan libres para otro comprobante.
  const otro = await svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id, cuotaIds: [item(f.id, 'CUOTA').id] });
  assert.equal(otro.comprobante.estado, 'GENERADO');
});

test('anular: EN_REVISION → 409; ADMIN → 403', async () => {
  const { id } = await generarCuotaYFutbol();
  await assert.rejects(svc.anularComprobante(ADMIN_ACTOR, id), httpError(403, svc.MSG_SOLO_PADRE_ANULA));
  await cargar(id);
  await assert.rejects(svc.anularComprobante(PADRE_ACTOR, id), httpError(409, svc.MSG_NO_ANULABLE));
  assert.equal(base.db.comprobantes[0].estado, 'EN_REVISION');
});

// ---- Aprobar ----

test('aprobar: crea el Pago por el total, ítems PAGADA, factura PARCIAL y avisa a cada padre por su canal', async () => {
  const { f, ids, id } = await generarCuotaYFutbol();
  await cargar(id);
  base.db.notificaciones.length = 0;
  const info = mock.method(logger, 'info', () => {});

  const r = await svc.aprobarComprobante(ADMIN_ACTOR, id, {}, { hoy: HOY });
  assert.equal(r.comprobante.estado, 'APROBADO');
  assert.equal(base.db.pagos.length, 1);
  const pago = base.db.pagos[0];
  assert.equal(Number(pago.monto), 290000);
  assert.equal(pago.comprobanteId, id);
  assert.equal(pago.facturaId, f.id);
  assert.equal(pago.registradoPorId, ADMIN);
  assert.equal(base.db.comprobantes[0].revisadoPorId, ADMIN);
  for (const it of base.items(f.id)) assert.equal(it.estado, ids.includes(it.id) ? 'PAGADA' : 'PENDIENTE');
  assert.equal(f.estado, 'PARCIAL');
  assert.deepEqual(r.factura, {
    id: f.id,
    numero: f.numero,
    estado: 'PARCIAL',
    total: 423000,
    pagado: 290000,
    saldo: 133000,
  });
  assert.equal(r.comprobante.pago?.monto, 290000);

  const audit = base.db.auditoria.at(-1);
  assert.equal(audit.accion, 'ALTA');
  assert.equal(audit.entidad, 'Pago');

  // PADRE_INTERNA → campanita; PADRE_EMAIL → canal EMAIL (queda en el log).
  assert.deepEqual(
    base.db.notificaciones.map((n) => [n.userId, n.titulo]),
    [[PADRE_INTERNA, 'Pago acreditado']],
  );
  assert.match(base.db.notificaciones[0].contenido, /saldo pendiente \$\s133\.000,00/);
  assert.match(base.db.notificaciones[0].contenido, /período Noviembre 2026/);
  // En los tests no hay proveedor de mails: el envío queda en el log de mail.service.
  const mail = info.mock.calls.find((c) => String(c.arguments[0]).startsWith('Mail sin enviar'));
  assert.ok(mail, 'se esperaba un envío por EMAIL');
  const meta = mail.arguments[1] as { to: string; asunto: string };
  assert.equal(meta.to, `${PADRE_EMAIL}@test.local`);
  assert.equal(meta.asunto, 'Pago acreditado');
});

test('aprobar: dos comprobantes que cubren toda la factura → PAGADA (HU8: una factura, varios comprobantes)', async () => {
  const { f, id } = await generarCuotaYFutbol();
  await cargar(id);
  await svc.aprobarComprobante(ADMIN_ACTOR, id, {}, { hoy: HOY });
  assert.equal(f.estado, 'PARCIAL');

  const resto = base.items(f.id).filter((i) => i.estado === 'PENDIENTE');
  const r2 = await svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id, cuotaIds: resto.map((i) => i.id) });
  assert.equal(r2.comprobante.total, 133000);
  await cargar(r2.comprobante.id, { montoTransferido: '133000.00' });
  const r = await svc.aprobarComprobante(ADMIN_ACTOR, r2.comprobante.id, { fechaAcreditacion: HOY }, { hoy: HOY });

  assert.equal(r.factura.estado, 'PAGADA');
  assert.equal(r.factura.saldo, 0);
  assert.equal(f.estado, 'PAGADA');
  assert.equal(base.db.pagos.length, 2);
  assert.equal(base.db.comprobantes.filter((c) => c.facturaId === f.id && c.estado === 'APROBADO').length, 2);
  assert.ok(base.items(f.id).every((i) => i.estado === 'PAGADA'));
  assert.match(base.db.notificaciones.at(-1).contenido, /La factura quedó pagada\./);
});

test('aprobar: segunda aprobación → 409 sin crear otro Pago', async () => {
  const { id } = await generarCuotaYFutbol();
  await cargar(id);
  await svc.aprobarComprobante(ADMIN_ACTOR, id, {}, { hoy: HOY });
  await assert.rejects(svc.aprobarComprobante(ADMIN_ACTOR, id, {}, { hoy: HOY }), httpError(409, svc.MSG_NO_REVISABLE));
  assert.equal(base.db.pagos.length, 1);
});

test('aprobar: el @unique de Pago.comprobanteId es la segunda barrera (P2002 → 409 y rollback)', async () => {
  const { f, id } = await generarCuotaYFutbol();
  await cargar(id);
  base.db.pagos.push({ id: 99, comprobanteId: id, facturaId: f.id, monto: 1 });
  await assert.rejects(svc.aprobarComprobante(ADMIN_ACTOR, id, {}, { hoy: HOY }), httpError(409));
  assert.equal(base.db.comprobantes[0].estado, 'EN_REVISION');
  assert.equal(base.db.pagos.length, 1);
});

test('aprobar: no se puede aprobar un GENERADO; fecha futura o anterior a la transferencia → 400', async () => {
  const { id } = await generarCuotaYFutbol();
  await assert.rejects(svc.aprobarComprobante(ADMIN_ACTOR, id, {}, { hoy: HOY }), httpError(409));
  await cargar(id); // transferencia del 2026-11-04
  await assert.rejects(
    svc.aprobarComprobante(ADMIN_ACTOR, id, { fechaAcreditacion: '2026-11-06' }, { hoy: HOY }),
    httpError(400, /futura/),
  );
  await assert.rejects(
    svc.aprobarComprobante(ADMIN_ACTOR, id, { fechaAcreditacion: '2026-11-03' }, { hoy: HOY }),
    httpError(400, /anterior a la de la transferencia/),
  );
  const r = await svc.aprobarComprobante(ADMIN_ACTOR, id, { fechaAcreditacion: '2026-11-04' }, { hoy: HOY });
  assert.equal(r.comprobante.pago?.fechaAcreditacion, '2026-11-04T15:00:00.000Z');
});

// ---- Rechazar ----

test('rechazar: motivo de menos de 5 o más de 300 caracteres → 400', async () => {
  const { id } = await generarCuotaYFutbol();
  await cargar(id);
  for (const motivo of ['', 'mal', '   abcd  ', 'x'.repeat(301), undefined]) {
    await assert.rejects(svc.rechazarComprobante(ADMIN_ACTOR, id, { motivo }), httpError(400, svc.MSG_MOTIVO_RECHAZO));
  }
  assert.equal(base.db.comprobantes[0].estado, 'EN_REVISION');
});

test('rechazar: ítems vuelven a PENDIENTE, la factura no cambia y se avisa con el motivo', async () => {
  const { f, id } = await generarCuotaYFutbol();
  await cargar(id);
  base.db.notificaciones.length = 0;
  const motivo = 'El monto no figura acreditado en la cuenta.';
  const r = await svc.rechazarComprobante(ADMIN_ACTOR, id, { motivo: `  ${motivo} ` });
  assert.equal(r.comprobante.estado, 'RECHAZADO');
  assert.equal(r.comprobante.motivoRechazo, motivo);
  assert.equal(base.db.comprobantes[0].revisadoPorId, ADMIN);
  assert.ok(base.items(f.id).every((i) => i.estado === 'PENDIENTE'));
  assert.equal(f.estado, 'PENDIENTE');
  assert.equal(base.db.pagos.length, 0);
  assert.equal(base.db.auditoria.at(-1).detalle, `${r.comprobante.numero} — rechazado: ${motivo}`);
  assert.deepEqual(
    base.db.notificaciones.map((n) => [n.userId, n.titulo]),
    [[PADRE_INTERNA, 'Comprobante rechazado']],
  );
  // El punto final del motivo no se duplica.
  assert.match(base.db.notificaciones[0].contenido, /Motivo: El monto no figura acreditado en la cuenta\. Los ítems/);
  assert.match(base.db.notificaciones[0].contenido, /generá un comprobante nuevo/);
  // Segunda revisión → 409.
  await assert.rejects(svc.rechazarComprobante(ADMIN_ACTOR, id, { motivo }), httpError(409));
});

// ---- Bandeja del admin ----

test('listar: por defecto EN_REVISION, el más viejo primero, con limit máximo 100', async () => {
  const { id: a } = await generarCuotaYFutbol();
  const f = nov();
  const r2 = await svc.generarComprobante(PADRE_ACTOR, { facturaId: f.id, cuotaIds: [item(f.id, 'COMEDOR').id] });
  const b = r2.comprobante.id;
  await cargar(b, { montoTransferido: '60000' });
  await cargar(a);
  // b se cargó primero.
  base.db.comprobantes.find((c) => c.id === b).cargadoEn = new Date('2026-11-04T10:00:00Z');

  const l = await svc.listarComprobantesAdmin({ limit: '500' });
  assert.equal(l.total, 2);
  assert.equal(l.limit, 100);
  assert.deepEqual(
    l.comprobantes.map((c) => c.id),
    [b, a],
  );
  const c = l.comprobantes[0];
  assert.equal(c.padre.id, PADRE_EMAIL);
  assert.equal(c.montoTransferido, 60000);
  assert.equal(c.tieneArchivo, true);
  assert.deepEqual(Object.keys(c.factura), ['id', 'numero', 'periodo']);

  assert.equal((await svc.listarComprobantesAdmin({ estado: 'aprobado' })).total, 0);
  assert.equal((await svc.listarComprobantesAdmin({ estudianteId: String(ALUMNO_OTRO) })).total, 0);
  await assert.rejects(svc.listarComprobantesAdmin({ estado: 'PAGADO' }), ZodError);
  await assert.rejects(svc.listarComprobantesAdmin({ desde: '2026-11-10', hasta: '2026-11-01' }), httpError(400));
});
