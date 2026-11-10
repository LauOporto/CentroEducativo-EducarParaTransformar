import { EstadoComprobante, MedioPago, Prisma, type Cuota } from '@prisma/client';

// Se usa el cliente y los servicios de src/ (como seed.ts ya hace con
// generarLegajo): la facturación y el recálculo de estados son la misma
// lógica de negocio que usa la API, no una copia.
import { prisma } from '../src/db/prisma';
import { sumar } from '../src/utils/montos';
import { generarFacturasPeriodo, recalcularEstadoFactura } from '../src/services/facturacion.service';

// Seed de la Parte 3: precios ficticios en ARS, facturas de 3 períodos y un
// historial de pagos determinístico. Idempotente: se corre muchas veces
// (también en el e2e de CI) y no duplica nada:
// - los precios se cargan solo si siguen en 0 (no pisa lo que fijó el Admin);
// - generarFacturasPeriodo no toca facturas existentes;
// - comprobantes por numero fijo (upsert) y pagos por comprobanteId (upsert).

const CUOTA_POR_NIVEL: Record<string, number> = { Inicial: 180000, Primaria: 220000, Secundaria: 260000 };
const PRECIO_DEPORTE: Record<string, number> = {
  Fútbol: 32000,
  Vóleibol: 28000,
  Básquet: 30000,
  'Artes Marciales': 27000,
  Danza: 38000,
  Atletismo: 25000,
  Natación: 45000,
  Ajedrez: 26000,
};
const PRECIO_RECORRIDO: Record<string, number> = {
  'Recorrido Norte': 35000,
  'Recorrido Sur': 42000,
  'Recorrido Este': 48000,
  'Recorrido Oeste': 55000,
};
const PRECIO_TURNO: Record<string, number> = { 'Primer turno': 60000, 'Segundo turno': 65000 };

export const PERIODOS_SEED = ['2026-09', '2026-10', '2026-11'];

// Valores determinísticos para registros que no están en las tablas de
// arriba (creados desde la plataforma): dentro del rango y sin repetir.
function precioLibre(rango: [number, number], paso: number, usados: Set<number>): number {
  for (let v = rango[0]; v <= rango[1]; v += paso) {
    if (!usados.has(v)) {
      usados.add(v);
      return v;
    }
  }
  return rango[0];
}

async function cargarPrecios() {
  const sinPrecio = { equals: new Prisma.Decimal(0) };

  for (const n of await prisma.nivelEducativo.findMany({
    where: { cuotaMensual: sinPrecio },
    orderBy: { id: 'asc' },
  })) {
    const valor = CUOTA_POR_NIVEL[n.nombre] ?? 220000;
    await prisma.nivelEducativo.update({ where: { id: n.id }, data: { cuotaMensual: valor } });
  }

  const tablas = [
    {
      filas: await prisma.deporte.findMany({ orderBy: { id: 'asc' } }),
      tabla: PRECIO_DEPORTE,
      rango: [25000, 45000] as [number, number],
      modelo: 'deporte' as const,
    },
    {
      filas: await prisma.recorridoTransporte.findMany({ orderBy: { id: 'asc' } }),
      tabla: PRECIO_RECORRIDO,
      rango: [35000, 55000] as [number, number],
      modelo: 'recorrido' as const,
    },
    {
      filas: await prisma.turnoComedor.findMany({ orderBy: { id: 'asc' } }),
      tabla: PRECIO_TURNO,
      rango: [60000, 65000] as [number, number],
      modelo: 'turno' as const,
    },
  ];
  for (const { filas, tabla, rango, modelo } of tablas) {
    const usados = new Set(Object.values(tabla));
    for (const f of filas) {
      if (!new Prisma.Decimal(f.precioMensual).isZero()) continue;
      const valor = tabla[f.nombre] ?? precioLibre(rango, 500, usados);
      const data = { precioMensual: valor };
      if (modelo === 'deporte') await prisma.deporte.update({ where: { id: f.id }, data });
      else if (modelo === 'recorrido') await prisma.recorridoTransporte.update({ where: { id: f.id }, data });
      else await prisma.turnoComedor.update({ where: { id: f.id }, data });
    }
  }
}

type FacturaSeed = Prisma.FacturaGetPayload<{ include: { cuotas: true } }>;

interface ComprobanteSeed {
  numero: string;
  cuotas: Cuota[];
  estado: EstadoComprobante;
  dia: number; // día del mes del período en que se transfirió
  motivoRechazo?: string;
}

// CP-AAAAMM-9XXXXX: el 9 inicial separa los números del seed de los que
// genera la API a partir del id (F3), así nunca chocan.
const numeroComprobante = (f: FacturaSeed, k: number) =>
  `CP-${f.periodo.replace('-', '')}-${String(900000 + f.estudianteId * 10 + k)}`;

const fechaHora = (periodo: string, dia: number, hhmm: string) =>
  new Date(`${periodo}-${String(dia).padStart(2, '0')}T${hhmm}:00.000-03:00`);

async function asegurarComprobantes(f: FacturaSeed, padreId: number, adminId: number, comprobantes: ComprobanteSeed[]) {
  await prisma.$transaction(async (tx) => {
    for (const c of comprobantes) {
      const total = sumar(c.cuotas.map((q) => q.importe));
      const revisado = c.estado === EstadoComprobante.APROBADO || c.estado === EstadoComprobante.RECHAZADO;
      const comprobante = await tx.comprobantePago.upsert({
        where: { numero: c.numero },
        update: {},
        create: {
          numero: c.numero,
          facturaId: f.id,
          generadoPorId: padreId,
          total,
          medio: MedioPago.TRANSFERENCIA,
          estado: c.estado,
          archivoId: null, // sin archivo real en el seed
          nroOperacion: `SEED-${c.numero.slice(3)}`,
          fechaTransferencia: new Date(`${f.periodo}-${String(c.dia).padStart(2, '0')}T00:00:00.000Z`),
          montoTransferido: total,
          cargadoEn: fechaHora(f.periodo, c.dia, '15:00'),
          revisadoPorId: revisado ? adminId : null,
          revisadoEn: revisado ? fechaHora(f.periodo, c.dia + 1, '11:00') : null,
          motivoRechazo: c.motivoRechazo ?? null,
          items: { create: c.cuotas.map((q) => ({ cuotaId: q.id, importe: q.importe })) },
        },
      });
      if (comprobante.estado === EstadoComprobante.APROBADO) {
        await tx.pago.upsert({
          where: { comprobanteId: comprobante.id },
          update: {},
          create: {
            comprobanteId: comprobante.id,
            facturaId: f.id,
            estudianteId: f.estudianteId,
            monto: comprobante.total,
            fechaAcreditacion: fechaHora(f.periodo, c.dia + 1, '11:00'),
            registradoPorId: adminId,
          },
        });
      }
    }
    await recalcularEstadoFactura(f.id, tx);
  });
}

export async function seedFacturacion() {
  try {
    await cargarPrecios();

    const resultados = [];
    for (const periodo of PERIODOS_SEED) {
      resultados.push(await generarFacturasPeriodo(periodo));
      // La emisión real (HU9) es el último día hábil del mes anterior; el seed
      // genera todo hoy, así que se fecha la emisión el último día de ese mes
      // (solo en las facturas del seed emitidas después de su vencimiento).
      const [anio, mes] = periodo.split('-').map(Number);
      const ultimoDiaAnterior = new Date(Date.UTC(anio, mes - 1, 0)).toISOString().slice(0, 10);
      await prisma.factura.updateMany({
        where: { periodo, emitidaEn: { gt: new Date(`${periodo}-10T00:00:00.000Z`) } },
        data: { emitidaEn: new Date(`${ultimoDiaAnterior}T08:00:00.000-03:00`) },
      });
    }

    const usuarios = await prisma.user.findMany({ select: { id: true, usuario: true, role: true } });
    const uid = new Map(usuarios.map((u) => [u.usuario, u.id]));
    const adminId = uid.get('admin') ?? usuarios.find((u) => u.role === 'ADMIN')?.id;
    if (!adminId) throw new Error('El seed de facturación necesita al menos un usuario ADMIN.');
    const padrePorHijo = new Map(
      (await prisma.parentStudentLink.findMany({ orderBy: { id: 'asc' } }))
        .reverse()
        .map((l) => [l.estudianteId, l.padreId]),
    );

    const facturas = await prisma.factura.findMany({
      where: { periodo: { in: PERIODOS_SEED } },
      include: { cuotas: { orderBy: [{ concepto: 'asc' }, { id: 'asc' }] } },
      orderBy: { id: 'asc' },
    });
    const factura = (usuario: string, periodo: string) =>
      facturas.find((f) => f.estudianteId === uid.get(usuario) && f.periodo === periodo);

    const todas = (f: FacturaSeed, k = 1, dia = 5): ComprobanteSeed => ({
      numero: numeroComprobante(f, k),
      cuotas: f.cuotas,
      estado: EstadoComprobante.APROBADO,
      dia,
    });

    // Historial fijo para la demo (padres con usuario conocido).
    const especiales = new Map<number, ComprobanteSeed[]>();
    const fb09 = factura('fbarrabino', '2026-09');
    const fb10 = factura('fbarrabino', '2026-10');
    const mg09 = factura('mgomez', '2026-09');
    const if10 = factura('iflores', '2026-10');
    // fbarrabino: 09 PAGADA; 10 PARCIAL (solo la CUOTA); 11 PENDIENTE.
    if (fb09) especiales.set(fb09.id, [todas(fb09)]);
    if (fb10) {
      especiales.set(fb10.id, [
        {
          numero: numeroComprobante(fb10, 1),
          cuotas: fb10.cuotas.filter((c) => c.concepto === 'CUOTA'),
          estado: EstadoComprobante.APROBADO,
          dia: 6,
        },
      ]);
    }
    // mgomez: 09 PAGADA con DOS comprobantes (una factura admite varios).
    if (mg09) {
      especiales.set(mg09.id, [
        {
          numero: numeroComprobante(mg09, 1),
          cuotas: mg09.cuotas.filter((c) => c.concepto === 'CUOTA'),
          estado: EstadoComprobante.APROBADO,
          dia: 4,
        },
        {
          numero: numeroComprobante(mg09, 2),
          cuotas: mg09.cuotas.filter((c) => c.concepto !== 'CUOTA'),
          estado: EstadoComprobante.APROBADO,
          dia: 8,
        },
      ]);
    }
    // iflores: 10 con uno RECHAZADO y, después, uno EN_REVISION por los mismos
    // ítems (para la demo de aprobación de F3/F7).
    if (if10) {
      especiales.set(if10.id, [
        {
          ...todas(if10, 1, 5),
          estado: EstadoComprobante.RECHAZADO,
          motivoRechazo: 'El monto transferido no coincide con el comprobante.',
        },
        { ...todas(if10, 2, 8), estado: EstadoComprobante.EN_REVISION },
      ]);
    }
    const conHistorialFijo = new Set(['fbarrabino', 'mgomez', 'iflores'].map((u) => uid.get(u)));

    let comprobantes = 0;
    for (const f of facturas) {
      const padreId = padrePorHijo.get(f.estudianteId);
      if (!padreId) continue;
      let lista = especiales.get(f.id);
      // Resto de los alumnos: 09 pagada si el id es par; 10 pagada si es
      // múltiplo de 3. Así hay pagos completos e incompletos para los reportes.
      if (!lista && !conHistorialFijo.has(f.estudianteId)) {
        const paga =
          (f.periodo === '2026-09' && f.estudianteId % 2 === 0) ||
          (f.periodo === '2026-10' && f.estudianteId % 3 === 0);
        if (paga) lista = [todas(f)];
      }
      if (!lista) continue;
      await asegurarComprobantes(f, padreId, adminId, lista);
      comprobantes += lista.length;
    }

    const [nFacturas, nCuotas, nComprobantes, nPagos] = await Promise.all([
      prisma.factura.count(),
      prisma.cuota.count(),
      prisma.comprobantePago.count(),
      prisma.pago.count(),
    ]);
    console.log(
      `   Facturación: ${resultados.map((r) => `${r.periodo} +${r.creadas}`).join(' · ')} facturas nuevas · ` +
        `${comprobantes} comprobantes de demo asegurados · en la base: ${nFacturas} facturas, ${nCuotas} ítems, ` +
        `${nComprobantes} comprobantes, ${nPagos} pagos`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1]?.includes('seed-facturacion')) {
  seedFacturacion().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
