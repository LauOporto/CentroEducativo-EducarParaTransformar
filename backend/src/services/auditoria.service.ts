import { AccionAuditoria } from '@prisma/client';

import { prisma } from '../db/prisma';

// RNF-46: registra quién hizo cada alta/modificación/baja sobre alumnos,
// profesores e inscripciones. Se llama explícitamente desde cada handler
// que escribe (no hay middleware "mágico" que intercepte todo: sería más
// genérico pero también ocultaría qué se audita y qué no).
export async function registrarAuditoria(params: {
  usuarioId: number;
  accion: AccionAuditoria;
  entidad: string;
  entidadId: number;
  detalle?: string;
}) {
  await prisma.auditLog.create({
    data: {
      usuarioId: params.usuarioId,
      accion: params.accion,
      entidad: params.entidad,
      entidadId: params.entidadId,
      detalle: params.detalle ?? null,
    },
  });
}
