import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { AccionAuditoria, CanalNotificacion, EstadoComprobante, EstadoCuota, Prisma, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { CURSO_SELECT, formatCursoLabel } from '../utils/cursoLabel';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';
import { decimal, formatearPesos, sumar, toMonto } from '../utils/montos';
import { esFechaValida, fechaISO, fechaUTC, hoyArgentina } from '../utils/fechas';
import { assertPuedeVerPagos } from '../utils/pagosAccess';
import { registrarAuditoria } from './auditoria.service';
import { recalcularEstadoFactura } from './facturacion.service';
import { almacenamiento, type UrlTemporal } from './almacenamiento';
import { crearNotificacion } from './notificaciones/notificacionFactory';
import { datosBancarios, LEYENDA_TRANSFERENCIA } from './facturaPdf.service';

// RF-50 (D5): comprobantes de pago. El padre elige ítems PENDIENTES de UNA
// factura, el sistema emite el comprobante con los datos para transferir, el
// padre carga la transferencia y el Administrador la aprueba o la rechaza.
// Toda transición de estado es un compare-and-set (updateMany con el estado
// esperado en el where) dentro de una transacción: si dos requests compiten,
// solo una cambia filas y la otra recibe 409, sin SQL crudo ni locks.

export type Actor = NonNullable<Request['authUser']>;

export const MSG_SOLO_PADRE_GENERA = 'Solo el Padre/Tutor puede generar comprobantes de pago.';
export const MSG_ITEMS_OCUPADOS = 'Alguno de los ítems ya está incluido en otro comprobante o ya fue pagado.';
export const MSG_COMPROBANTE_INEXISTENTE = 'El comprobante indicado no existe.';
export const MSG_SOLO_PADRE_ANULA = 'Solo el Padre/Tutor puede anular comprobantes de pago.';
export const MSG_SOLO_PADRE_TRANSFERENCIA = 'Solo el Padre/Tutor puede cargar la transferencia.';
export const MSG_TRANSFERENCIA_NO_ADMITIDA = 'Este comprobante ya tiene una transferencia cargada o no admite cambios.';
export const MSG_SOLO_TRANSFERENCIA = LEYENDA_TRANSFERENCIA;
export const MSG_ARCHIVO_INVALIDO = 'El archivo debe ser una imagen JPG/PNG o un PDF.';
export const MSG_SIN_ARCHIVO = 'Este comprobante no tiene archivo de transferencia.';
export const DIAS_MAX_ANTIGUEDAD_TRANSFERENCIA = 60;
export const MSG_NO_ANULABLE = 'Solo se puede anular un comprobante que todavía no tiene la transferencia cargada.';

const conRequest = (actor: Actor) => ({ authUser: actor });

// CP-AAAAMM-000123: del id autoincremental, igual que la factura (nunca
// contando filas). Los del seed usan 9XXXXX y no chocan.
export const numeroComprobante = (periodo: string, id: number) =>
  `CP-${periodo.replace('-', '')}-${String(id).padStart(6, '0')}`;

export const instruccionesTransferencia = (total: Prisma.Decimal | number, numero: string) =>
  `Transferí exactamente ${formatearPesos(total)} e indicá el N.º de comprobante ${numero} en el concepto de la transferencia.`;

export const COMPROBANTE_INCLUDE = {
  items: {
    orderBy: { id: 'asc' },
    include: { cuota: { select: { concepto: true, descripcion: true } } },
  },
  factura: {
    select: {
      id: true,
      numero: true,
      periodo: true,
      vencimiento: true,
      estado: true,
      estudianteId: true,
      estudiante: { select: { id: true, nombre: true, legajo: true, curso: { select: CURSO_SELECT } } },
    },
  },
  generadoPor: { select: { id: true, nombre: true } },
  pago: { select: { id: true, monto: true, fechaAcreditacion: true } },
} satisfies Prisma.ComprobantePagoInclude;

export type ComprobanteCompleto = Prisma.ComprobantePagoGetPayload<{ include: typeof COMPROBANTE_INCLUDE }>;

// Vista JSON del comprobante (padre y admin). Nunca expone archivoId: el
// archivo se pide aparte con una URL temporal (D6).
export function vistaComprobante(c: ComprobanteCompleto) {
  const e = c.factura.estudiante;
  return {
    id: c.id,
    numero: c.numero,
    estado: c.estado,
    medio: c.medio,
    total: toMonto(c.total),
    generadoEn: c.createdAt.toISOString(),
    items: c.items.map((i) => ({
      cuotaId: i.cuotaId,
      concepto: i.cuota.concepto,
      descripcion: i.cuota.descripcion,
      importe: toMonto(i.importe),
    })),
    factura: {
      id: c.factura.id,
      numero: c.factura.numero,
      periodo: c.factura.periodo,
      vencimiento: fechaISO(c.factura.vencimiento),
      estado: c.factura.estado,
    },
    alumno: { id: e.id, nombre: e.nombre, curso: formatCursoLabel(e.curso) },
    padre: { id: c.generadoPor.id, nombre: c.generadoPor.nombre },
    transferencia: c.cargadoEn
      ? {
          nroOperacion: c.nroOperacion,
          fechaTransferencia: c.fechaTransferencia ? fechaISO(c.fechaTransferencia) : null,
          montoTransferido: c.montoTransferido === null ? null : toMonto(c.montoTransferido),
          cargadoEn: c.cargadoEn.toISOString(),
        }
      : null,
    tieneArchivo: c.archivoId !== null,
    motivoRechazo: c.motivoRechazo,
    revisadoEn: c.revisadoEn?.toISOString() ?? null,
    pago: c.pago
      ? { id: c.pago.id, monto: toMonto(c.pago.monto), fechaAcreditacion: c.pago.fechaAcreditacion.toISOString() }
      : null,
  };
}

export async function buscarComprobante(id: number): Promise<ComprobanteCompleto> {
  const c = await prisma.comprobantePago.findUnique({ where: { id }, include: COMPROBANTE_INCLUDE });
  if (!c) throw HttpError.notFound(MSG_COMPROBANTE_INEXISTENTE);
  return c;
}

// Padre vinculado al alumno de la factura, o ADMIN (D7).
export async function comprobanteVisible(actor: Actor, id: number) {
  const c = await buscarComprobante(id);
  await assertPuedeVerPagos(conRequest(actor), c.factura.estudianteId);
  return c;
}

// Solo el PADRE vinculado: el ADMIN ve pero no opera en nombre de la familia.
export async function comprobanteDelPadre(actor: Actor, id: number, mensajeRol: string) {
  if (actor.role !== Role.PADRE) throw HttpError.forbidden(mensajeRol);
  return comprobanteVisible(actor, id);
}

// ---- D5 paso 1: generar ----

const ESTADO_ITEM_OCUPADO: Partial<Record<EstadoCuota, string>> = {
  EN_REVISION: 'ya está incluido en otro comprobante',
  PAGADA: 'ya está pagado',
};

const generarSchema = z.object({
  facturaId: z.coerce.number().int().positive(),
  cuotaIds: z.array(z.coerce.number().int().positive()),
});

// El rol se chequea antes que el formato del body: un ADMIN recibe 403 aunque
// mande cualquier cosa.
export async function generarComprobante(actor: Actor, body: unknown) {
  if (actor.role !== Role.PADRE) throw HttpError.forbidden(MSG_SOLO_PADRE_GENERA);
  const { facturaId, cuotaIds } = generarSchema.parse(body);
  if (cuotaIds.length === 0) throw HttpError.badRequest('Elegí al menos un ítem para pagar.');
  if (new Set(cuotaIds).size !== cuotaIds.length) throw HttpError.badRequest('Hay ítems repetidos en la selección.');

  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    select: { id: true, numero: true, periodo: true, estudianteId: true },
  });
  if (!factura) throw HttpError.notFound('La factura indicada no existe.');
  await assertPuedeVerPagos(conRequest(actor), factura.estudianteId);

  const cuotas = await prisma.cuota.findMany({
    where: { id: { in: cuotaIds } },
    select: { id: true, facturaId: true, descripcion: true, importe: true, estado: true },
    orderBy: { id: 'asc' },
  });
  if (cuotas.length !== cuotaIds.length || cuotas.some((c) => c.facturaId !== facturaId)) {
    throw HttpError.badRequest(`Alguno de los ítems no pertenece a la factura ${factura.numero}.`);
  }
  for (const c of cuotas) {
    if (c.estado !== EstadoCuota.PENDIENTE) {
      throw HttpError.conflict(`El ítem "${c.descripcion}" ${ESTADO_ITEM_OCUPADO[c.estado] ?? 'no está pendiente'}.`);
    }
  }

  const total = sumar(cuotas.map((c) => c.importe));
  const creado = await prisma.$transaction(async (tx) => {
    // Compare-and-set: solo pasan a EN_REVISION los que siguen PENDIENTES. Si
    // otro comprobante ganó la carrera por alguno, el count no da y se
    // revierte todo (no queda comprobante a medias).
    const marcados = await tx.cuota.updateMany({
      where: { id: { in: cuotaIds }, facturaId, estado: EstadoCuota.PENDIENTE },
      data: { estado: EstadoCuota.EN_REVISION },
    });
    if (marcados.count !== cuotaIds.length) throw HttpError.conflict(MSG_ITEMS_OCUPADOS);

    const { id } = await tx.comprobantePago.create({
      data: {
        numero: `TMP-${randomUUID()}`,
        facturaId,
        generadoPorId: actor.id,
        total,
        items: { create: cuotas.map((c) => ({ cuotaId: c.id, importe: c.importe })) },
      },
      select: { id: true },
    });
    const numero = numeroComprobante(factura.periodo, id);
    await tx.comprobantePago.update({ where: { id }, data: { numero } });
    await recalcularEstadoFactura(facturaId, tx);
    return { id, numero };
  });

  await registrarAuditoria({
    usuarioId: actor.id,
    accion: AccionAuditoria.ALTA,
    entidad: 'ComprobantePago',
    entidadId: creado.id,
    detalle: `${creado.numero} — factura ${factura.numero} — ${formatearPesos(total)} — ${cuotas.length} ítem(s)`,
  });

  const c = await buscarComprobante(creado.id);
  return {
    comprobante: vistaComprobante(c),
    datosBancarios: datosBancarios(),
    instrucciones: instruccionesTransferencia(c.total, c.numero),
  };
}

// ---- Detalle ----

export async function obtenerComprobante(actor: Actor, id: number) {
  const c = await comprobanteVisible(actor, id);
  return {
    comprobante: vistaComprobante(c),
    datosBancarios: datosBancarios(),
    instrucciones: instruccionesTransferencia(c.total, c.numero),
  };
}

// ---- D5 paso 4: anular (solo GENERADO) ----

export async function anularComprobante(actor: Actor, id: number) {
  const c = await comprobanteDelPadre(actor, id, MSG_SOLO_PADRE_ANULA);
  if (c.estado !== EstadoComprobante.GENERADO) throw HttpError.conflict(MSG_NO_ANULABLE);

  await prisma.$transaction(async (tx) => {
    const r = await tx.comprobantePago.updateMany({
      where: { id, estado: EstadoComprobante.GENERADO },
      data: { estado: EstadoComprobante.ANULADO },
    });
    if (r.count !== 1) throw HttpError.conflict(MSG_NO_ANULABLE);
    // El comprobante ANULADO deja de estar activo: sus ítems vuelven a PENDIENTE.
    await recalcularEstadoFactura(c.factura.id, tx);
  });

  await registrarAuditoria({
    usuarioId: actor.id,
    accion: AccionAuditoria.MODIFICACION,
    entidad: 'ComprobantePago',
    entidadId: id,
    detalle: `${c.numero} — anulado`,
  });
  return { comprobante: vistaComprobante(await buscarComprobante(id)) };
}

// ---- D5 paso 3: cargar la transferencia ----

// Firma real del contenido (magic bytes): el mime que manda el cliente no
// alcanza, un .txt renombrado a .png llega como image/png.
export function detectarTipoArchivo(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) return 'image/png';
  if (buffer.length >= 4 && buffer.subarray(0, 4).toString('latin1') === '%PDF') return 'application/pdf';
  return null;
}

const MIME_NORMALIZADO: Record<string, string> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/pjpeg': 'image/jpeg',
  'image/png': 'image/png',
  'application/pdf': 'application/pdf',
};

export interface ArchivoRecibido {
  buffer: Buffer;
  mimetype: string;
}

const MONTO_RE = /^\d{1,10}([.,]\d{1,2})?$/;
const NRO_OPERACION_RE = /^[A-Za-z0-9-]{4,40}$/;

const texto = (v: unknown) =>
  typeof v === 'string' ? v.trim() : v === undefined || v === null ? '' : String(v).trim();

function restarDias(fecha: string, dias: number): string {
  const d = fechaUTC(fecha);
  d.setUTCDate(d.getUTCDate() - dias);
  return fechaISO(d);
}

// Orden de validación (D5): rol y vínculo → estado → medio → monto → resto de
// los campos → archivo. Recién con todo válido se sube el archivo.
export async function cargarTransferencia(
  actor: Actor,
  id: number,
  campos: Record<string, unknown>,
  archivo: ArchivoRecibido | undefined,
  opts: { hoy?: string } = {},
) {
  const c = await comprobanteDelPadre(actor, id, MSG_SOLO_PADRE_TRANSFERENCIA);
  if (c.estado !== EstadoComprobante.GENERADO) throw HttpError.conflict(MSG_TRANSFERENCIA_NO_ADMITIDA);

  const medio = texto(campos.medio);
  if (medio !== '' && medio.toUpperCase() !== 'TRANSFERENCIA') throw HttpError.badRequest(MSG_SOLO_TRANSFERENCIA);

  const montoTexto = texto(campos.montoTransferido);
  if (!MONTO_RE.test(montoTexto)) {
    throw HttpError.badRequest(
      'El monto transferido es inválido. Usá un número con hasta 2 decimales (ej. 290000.50).',
    );
  }
  const montoTransferido = decimal(montoTexto.replace(',', '.'));
  if (!montoTransferido.equals(c.total)) {
    throw new HttpError(422, `El monto transferido debe ser exactamente ${formatearPesos(c.total)}.`, {
      totalEsperado: toMonto(c.total),
    });
  }

  const nroOperacion = texto(campos.nroOperacion);
  if (!NRO_OPERACION_RE.test(nroOperacion)) {
    throw HttpError.badRequest(
      'El N.º de operación debe tener entre 4 y 40 caracteres: solo letras, números y guiones.',
    );
  }

  const fecha = texto(campos.fechaTransferencia);
  const hoy = opts.hoy ?? hoyArgentina();
  if (!esFechaValida(fecha)) {
    throw HttpError.badRequest('La fecha de la transferencia es inválida. Usá el formato AAAA-MM-DD.');
  }
  if (fecha > hoy) throw HttpError.badRequest('La fecha de la transferencia no puede ser futura.');
  if (fecha < restarDias(hoy, DIAS_MAX_ANTIGUEDAD_TRANSFERENCIA)) {
    throw HttpError.badRequest(
      `La fecha de la transferencia no puede tener más de ${DIAS_MAX_ANTIGUEDAD_TRANSFERENCIA} días.`,
    );
  }

  if (!archivo || archivo.buffer.length === 0) {
    throw HttpError.badRequest('Adjuntá el comprobante de la transferencia (JPG, PNG o PDF).');
  }
  const declarado = MIME_NORMALIZADO[archivo.mimetype.toLowerCase()];
  if (!declarado || detectarTipoArchivo(archivo.buffer) !== declarado) {
    throw HttpError.badRequest(MSG_ARCHIVO_INVALIDO);
  }

  // Fuera de la transacción: no se tiene una transacción abierta mientras se
  // sube a Cloudinary. Si después falla el cambio de estado, se borra.
  const subido = await almacenamiento.subirComprobante(archivo.buffer, declarado);
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.comprobantePago.updateMany({
        where: { id, estado: EstadoComprobante.GENERADO },
        data: {
          estado: EstadoComprobante.EN_REVISION,
          archivoId: subido.archivoId,
          archivoTipo: subido.archivoTipo,
          nroOperacion,
          fechaTransferencia: fechaUTC(fecha),
          montoTransferido,
          cargadoEn: new Date(),
        },
      });
      if (r.count !== 1) throw HttpError.conflict(MSG_TRANSFERENCIA_NO_ADMITIDA);
    });
  } catch (err) {
    await almacenamiento.eliminar(subido.archivoId, subido.archivoTipo);
    throw err;
  }

  await registrarAuditoria({
    usuarioId: actor.id,
    accion: AccionAuditoria.MODIFICACION,
    entidad: 'ComprobantePago',
    entidadId: id,
    detalle: `${c.numero} — transferencia cargada (op. ${nroOperacion}, ${formatearPesos(montoTransferido)})`,
  });

  await notificarAdmins(c);
  return { comprobante: vistaComprobante(await buscarComprobante(id)) };
}

// Aviso en la campanita de cada ADMIN activo (canal INTERNA fijo: es una
// tarea del panel, no un mensaje para el mail personal). Un fallo acá no
// deshace la carga: queda en el log.
async function notificarAdmins(c: ComprobanteCompleto) {
  try {
    const admins = await prisma.user.findMany({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    });
    for (const a of admins) {
      await crearNotificacion(CanalNotificacion.INTERNA, {
        destinatarioId: a.id,
        titulo: 'Nuevo comprobante para revisar',
        contenido: `${c.numero} — ${c.factura.estudiante.nombre} — ${formatearPesos(c.total)} (factura ${c.factura.numero}).`,
        link: '/admin/pagos',
      }).enviar();
    }
  } catch (err) {
    logger.error('No se pudo notificar a los administradores', {
      comprobanteId: c.id,
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

// GET .../archivo: URL temporal (5 min) del comprobante de transferencia.
export async function urlArchivoComprobante(actor: Actor, id: number, baseUrl: string): Promise<UrlTemporal> {
  const c = await comprobanteVisible(actor, id);
  if (!c.archivoId || !c.archivoTipo) throw HttpError.notFound(MSG_SIN_ARCHIVO);
  return almacenamiento.urlTemporal(c.archivoId, c.archivoTipo, baseUrl);
}
