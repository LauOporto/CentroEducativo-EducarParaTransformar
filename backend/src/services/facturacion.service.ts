import { randomUUID } from 'node:crypto';
import { AccionAuditoria, ConceptoCuota, EstadoAlumno, Prisma, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { sumar } from '../utils/montos';
import { validarPeriodo, vencimientoDePeriodo } from '../utils/fechas';
import { registrarAuditoria } from './auditoria.service';
import { DIA_LABEL, horaLabel } from './reportes/pdfHelpers';

// D8 + A3 + A4: emisión mensual de facturas. Cada ítem congela importe y
// descripción al emitir, así que un cambio de precio posterior no toca lo
// ya facturado. generarFacturasPeriodo es idempotente: una factura por
// alumno y período (@@unique en la base), y la existente no se modifica.

// A3: se factura a quien es ESTUDIANTE, está activo, en estado ACTIVO y
// tiene curso asignado.
export const ALUMNO_FACTURABLE = {
  role: Role.ESTUDIANTE,
  isActive: true,
  estado: EstadoAlumno.ACTIVO,
  cursoId: { not: null },
} satisfies Prisma.UserWhereInput;

export const MOTIVO_YA_FACTURADO = 'Ya tiene factura del período.';
export const MOTIVO_SIN_ITEMS = 'No tiene ítems con importe mayor a 0.';

const ALUMNO_A_FACTURAR = {
  id: true,
  curso: { select: { nivel: { select: { nombre: true, cuotaMensual: true } } } },
  inscripcionesDeporte: {
    select: {
      grupoDeporteId: true,
      grupoDeporte: {
        select: {
          diaSemana: true,
          horaInicio: true,
          horaFin: true,
          deporte: { select: { nombre: true, precioMensual: true } },
          nivel: { select: { nombre: true } },
          docente: { select: { nombre: true } },
        },
      },
    },
    orderBy: { grupoDeporteId: 'asc' },
  },
  inscripcionTransporte: {
    select: { recorridoId: true, recorrido: { select: { nombre: true, precioMensual: true } } },
  },
  inscripcionComedor: { select: { turnoId: true, turno: { select: { nombre: true, precioMensual: true } } } },
} satisfies Prisma.UserSelect;

export type AlumnoAFacturar = Prisma.UserGetPayload<{ select: typeof ALUMNO_A_FACTURAR }>;

export interface ItemFactura {
  concepto: ConceptoCuota;
  referenciaId: number;
  descripcion: string;
  importe: Prisma.Decimal;
}

// "Fútbol — Secundaria — Martes 15:00 a 16:30 — Prof. Andrés Martínez": el
// texto conserva el grupo tal como era el mes facturado (A4).
export function descripcionDeporte(g: AlumnoAFacturar['inscripcionesDeporte'][number]['grupoDeporte']): string {
  const dia = DIA_LABEL[g.diaSemana] ?? g.diaSemana;
  return `${g.deporte.nombre} — ${g.nivel.nombre} — ${dia} ${horaLabel(g.horaInicio)} a ${horaLabel(g.horaFin)} — Prof. ${g.docente.nombre}`;
}

// Arma los ítems del mes de un alumno, sin filtrar los de importe 0.
export function armarItems(alumno: AlumnoAFacturar): ItemFactura[] {
  const items: ItemFactura[] = [];
  const nivel = alumno.curso?.nivel;
  if (nivel) {
    items.push({
      concepto: ConceptoCuota.CUOTA,
      referenciaId: 0,
      descripcion: `Cuota mensual — ${nivel.nombre}`,
      importe: new Prisma.Decimal(nivel.cuotaMensual),
    });
  }
  for (const i of alumno.inscripcionesDeporte) {
    items.push({
      concepto: ConceptoCuota.DEPORTE,
      referenciaId: i.grupoDeporteId, // A4: el grupo, no el deporte
      descripcion: descripcionDeporte(i.grupoDeporte),
      importe: new Prisma.Decimal(i.grupoDeporte.deporte.precioMensual),
    });
  }
  if (alumno.inscripcionTransporte) {
    const t = alumno.inscripcionTransporte;
    items.push({
      concepto: ConceptoCuota.TRANSPORTE,
      referenciaId: t.recorridoId,
      descripcion: t.recorrido.nombre,
      importe: new Prisma.Decimal(t.recorrido.precioMensual),
    });
  }
  if (alumno.inscripcionComedor) {
    const c = alumno.inscripcionComedor;
    items.push({
      concepto: ConceptoCuota.COMEDOR,
      referenciaId: c.turnoId,
      descripcion: c.turno.nombre,
      importe: new Prisma.Decimal(c.turno.precioMensual),
    });
  }
  return items;
}

// F-AAAAMM-000123: sale del id autoincremental, nunca de contar filas (dos
// emisiones simultáneas contarían lo mismo y chocarían).
export const numeroFactura = (periodo: string, id: number) =>
  `F-${periodo.replace('-', '')}-${String(id).padStart(6, '0')}`;

const esUnicoDuplicado = (err: unknown) => (err as { code?: string } | null)?.code === 'P2002';

export interface ResultadoFacturacion {
  periodo: string;
  creadas: number;
  omitidas: number;
  detalleOmitidas: { estudianteId: number; motivo: string }[];
}

export async function generarFacturasPeriodo(
  periodo: string,
  opts: { usuarioId?: number } = {},
): Promise<ResultadoFacturacion> {
  validarPeriodo(periodo);
  const vencimiento = vencimientoDePeriodo(periodo);

  const [alumnos, existentes] = await Promise.all([
    prisma.user.findMany({ where: ALUMNO_FACTURABLE, select: ALUMNO_A_FACTURAR, orderBy: { id: 'asc' } }),
    prisma.factura.findMany({ where: { periodo }, select: { estudianteId: true } }),
  ]);
  const yaFacturados = new Set(existentes.map((f) => f.estudianteId));

  const resultado: ResultadoFacturacion = { periodo, creadas: 0, omitidas: 0, detalleOmitidas: [] };
  const omitir = (estudianteId: number, motivo: string) => {
    resultado.omitidas += 1;
    resultado.detalleOmitidas.push({ estudianteId, motivo });
  };

  for (const alumno of alumnos) {
    if (yaFacturados.has(alumno.id)) {
      omitir(alumno.id, MOTIVO_YA_FACTURADO);
      continue;
    }
    const items = armarItems(alumno).filter((i) => i.importe.greaterThan(0));
    if (items.length === 0) {
      omitir(alumno.id, MOTIVO_SIN_ITEMS);
      continue;
    }

    try {
      // Una transacción por alumno: si falla uno, los demás siguen.
      const factura = await prisma.$transaction(async (tx) => {
        const creada = await tx.factura.create({
          data: {
            numero: `TMP-${randomUUID()}`,
            estudianteId: alumno.id,
            periodo,
            vencimiento,
            total: sumar(items.map((i) => i.importe)),
            cuotas: { create: items.map((i) => ({ ...i, estudianteId: alumno.id, vencimiento })) },
          },
          select: { id: true },
        });
        return tx.factura.update({
          where: { id: creada.id },
          data: { numero: numeroFactura(periodo, creada.id) },
          select: { id: true, numero: true },
        });
      });
      resultado.creadas += 1;
      if (opts.usuarioId) {
        await registrarAuditoria({
          usuarioId: opts.usuarioId,
          accion: AccionAuditoria.ALTA,
          entidad: 'Factura',
          entidadId: factura.id,
          detalle: `${factura.numero} — período ${periodo}`,
        });
      }
    } catch (err) {
      // Otra emisión simultánea ya creó la factura de este alumno.
      if (esUnicoDuplicado(err)) omitir(alumno.id, MOTIVO_YA_FACTURADO);
      else throw err;
    }
  }

  return resultado;
}
