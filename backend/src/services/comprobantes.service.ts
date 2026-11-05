import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import { z } from 'zod';
import { AccionAuditoria, EstadoCuota, Prisma, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { CURSO_SELECT, formatCursoLabel } from '../utils/cursoLabel';
import { HttpError } from '../utils/httpError';
import { formatearPesos, sumar, toMonto } from '../utils/montos';
import { fechaISO } from '../utils/fechas';
import { assertPuedeVerPagos } from '../utils/pagosAccess';
import { registrarAuditoria } from './auditoria.service';
import { recalcularEstadoFactura } from './facturacion.service';
import { datosBancarios } from './facturaPdf.service';

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
