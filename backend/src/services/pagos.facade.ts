import { ConceptoCuota, EstadoCuota, Prisma } from '@prisma/client';

import { prisma } from '../db/prisma';
import { CURSO_SELECT, formatCursoLabel } from '../utils/cursoLabel';
import { HttpError } from '../utils/httpError';
import { sumar, toMonto } from '../utils/montos';
import { diaSiguiente, fechaISO, fechaUTC, hoyArgentina, inicioDiaArgentina, type RangoFechas } from '../utils/fechas';

// Fachada de pagos del Padre/Tutor (RF-49), mismo criterio que
// panelFamilia.facade: un caso de uso por función, para que la app y el web
// no tengan que orquestar facturas, ítems, comprobantes y pagos por separado.
// Todo se lee de la misma base que usa el web (RNF-56/57): el estado que se
// devuelve es el actual, sin copias.

// VENCIDA no se guarda (D4): un ítem PENDIENTE cuyo vencimiento ya pasó se
// informa como VENCIDA. EN_REVISION nunca vence: el padre ya pagó y el
// comprobante espera la revisión del Administrador.
export type EstadoItemVista = EstadoCuota | 'VENCIDA';

export function estadoItem(estado: EstadoCuota, vencimiento: Date, hoy: string): EstadoItemVista {
  return estado === EstadoCuota.PENDIENTE && fechaISO(vencimiento) < hoy ? 'VENCIDA' : estado;
}

const CONCEPTOS = [ConceptoCuota.CUOTA, ConceptoCuota.DEPORTE, ConceptoCuota.TRANSPORTE, ConceptoCuota.COMEDOR];

const FACTURA_INCLUDE = {
  cuotas: { orderBy: [{ concepto: 'asc' }, { id: 'asc' }] },
  comprobantes: {
    orderBy: { id: 'asc' },
    select: {
      id: true,
      numero: true,
      total: true,
      estado: true,
      nroOperacion: true,
      cargadoEn: true,
      motivoRechazo: true,
      archivoId: true,
    },
  },
  pagos: { select: { monto: true } },
} satisfies Prisma.FacturaInclude;

type AlumnoEstadoCuenta = { id: number; nombre: string; curso: { nombre: string; nivel: { nombre: string } } | null };

export async function obtenerEstadoCuenta(
  estudianteId: number,
  rango: RangoFechas,
  opts: { alumno?: AlumnoEstadoCuenta; hoy?: string } = {},
) {
  const hoy = opts.hoy ?? hoyArgentina();
  // assertPuedeVerPagos ya trae el alumno: se reutiliza para no repetir la
  // consulta (en total son 3 o 4 queries por request, sin N+1).
  const alumno =
    opts.alumno ??
    (await prisma.user.findUnique({
      where: { id: estudianteId },
      select: { id: true, nombre: true, curso: { select: CURSO_SELECT } },
    }));
  if (!alumno) throw HttpError.notFound('El alumno indicado no existe.');

  const [facturas, pagos] = await Promise.all([
    prisma.factura.findMany({
      where: { estudianteId, vencimiento: { gte: fechaUTC(rango.desde), lte: fechaUTC(rango.hasta) } },
      include: FACTURA_INCLUDE,
      orderBy: { periodo: 'desc' },
    }),
    prisma.pago.findMany({
      where: {
        estudianteId,
        fechaAcreditacion: { gte: inicioDiaArgentina(rango.desde), lt: inicioDiaArgentina(diaSiguiente(rango.hasta)) },
      },
      include: { comprobante: { select: { numero: true } }, factura: { select: { numero: true, periodo: true } } },
      orderBy: { fechaAcreditacion: 'desc' },
    }),
  ]);

  const items = facturas.flatMap((f) =>
    f.cuotas.map((c) => ({ ...c, estadoVista: estadoItem(c.estado, c.vencimiento, hoy) })),
  );
  const impagos = items.filter((i) => i.estado !== EstadoCuota.PAGADA);
  const importes = (lista: typeof items) => sumar(lista.map((i) => i.importe));

  const resumen = {
    totalAdeudado: toMonto(importes(impagos)),
    totalVencido: toMonto(importes(items.filter((i) => i.estadoVista === 'VENCIDA'))),
    totalEnRevision: toMonto(importes(items.filter((i) => i.estado === EstadoCuota.EN_REVISION))),
    totalPagado: toMonto(sumar(facturas.flatMap((f) => f.pagos.map((p) => p.monto)))),
    deudaPorConcepto: Object.fromEntries(
      CONCEPTOS.map((c) => [c, toMonto(importes(impagos.filter((i) => i.concepto === c)))]),
    ) as Record<ConceptoCuota, number>,
  };

  return {
    alumno: { id: alumno.id, nombre: alumno.nombre, curso: formatCursoLabel(alumno.curso) },
    rango,
    resumen,
    facturas: facturas.map((f) => {
      const pagado = sumar(f.pagos.map((p) => p.monto));
      return {
        id: f.id,
        numero: f.numero,
        periodo: f.periodo,
        emitidaEn: f.emitidaEn.toISOString(),
        vencimiento: fechaISO(f.vencimiento),
        total: toMonto(f.total),
        pagado: toMonto(pagado),
        saldo: toMonto(new Prisma.Decimal(f.total).minus(pagado)),
        estado: f.estado,
        items: f.cuotas.map((c) => ({
          id: c.id,
          concepto: c.concepto,
          descripcion: c.descripcion,
          importe: toMonto(c.importe),
          vencimiento: fechaISO(c.vencimiento),
          estado: estadoItem(c.estado, c.vencimiento, hoy),
        })),
        comprobantes: f.comprobantes.map((cp) => ({
          id: cp.id,
          numero: cp.numero,
          total: toMonto(cp.total),
          estado: cp.estado,
          nroOperacion: cp.nroOperacion,
          cargadoEn: cp.cargadoEn?.toISOString() ?? null,
          motivoRechazo: cp.motivoRechazo,
          tieneArchivo: cp.archivoId !== null,
        })),
      };
    }),
    pagos: pagos.map((p) => ({
      id: p.id,
      fechaAcreditacion: p.fechaAcreditacion.toISOString(),
      monto: toMonto(p.monto),
      comprobanteNumero: p.comprobante.numero,
      facturaNumero: p.factura.numero,
      periodo: p.factura.periodo,
    })),
  };
}
