import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';

// Los legajos se generan automáticamente, nunca se piden por formulario
// (pedido explícito: evita duplicados y errores de tipeo). Un legajo
// correlativo por rol, prefijo LEG- para alumnos y DOC- para profesores,
// buscando el máximo ya usado con ese prefijo e incrementando.
const PREFIJOS: Partial<Record<Role, string>> = {
  [Role.ESTUDIANTE]: 'LEG',
  [Role.DOCENTE]: 'DOC',
};

export async function generarLegajo(role: Role): Promise<string> {
  const prefijo = PREFIJOS[role];
  if (!prefijo) throw new Error(`No corresponde generar legajo para el rol ${role}.`);

  const existentes = await prisma.user.findMany({
    where: { legajo: { startsWith: `${prefijo}-` } },
    select: { legajo: true },
  });

  let max = 0;
  for (const { legajo } of existentes) {
    const match = legajo?.match(new RegExp(`^${prefijo}-(\\d+)$`));
    if (match) max = Math.max(max, Number(match[1]));
  }

  return `${prefijo}-${String(max + 1).padStart(4, '0')}`;
}
