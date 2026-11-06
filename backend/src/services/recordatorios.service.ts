import { EstadoCuota, EstadoFactura, Prisma, Role, TipoRecordatorio } from '@prisma/client';

import { prisma } from '../db/prisma';
import { logger } from '../utils/logger';
import { esUltimoDiaHabil, fechaISO, hoyArgentina, periodoDeFecha, periodoSiguiente } from '../utils/fechas';
import { sumar, CERO } from '../utils/montos';
import { generarFacturasPeriodo, type ResultadoFacturacion } from './facturacion.service';
import {
  CONCEPTO_LABEL,
  datosBancarios,
  fechaLarga,
  generarPdfFactura,
  LEYENDA_TRANSFERENCIA,
  nombreArchivoFactura,
  periodoLabel,
  pesos,
} from './facturaPdf.service';
import { enviarMail, htmlMail, type Mail } from './mail.service';

// HU9 (D11): mails automáticos de facturación.
// - EMISION, el último día hábil del mes: se generan las facturas del mes
//   siguiente y cada padre recibe la de cada hijo, con la composición del
//   monto, los datos para transferir y el PDF adjunto.
// - DEUDA, el día 20: aviso a los padres de las facturas del mes con saldo
//   pendiente (solo si el pago no fue completo).
// Cada envío queda en EnvioRecordatorio (uno por tipo, factura y padre): el
// job se puede correr varias veces sin repetir mails, y lo que falló se
// reintenta en la próxima corrida.

/** Marca de un envío "reservado" por una corrida que todavía no terminó. */
export const EN_CURSO = 'EN_CURSO';
/** Si una corrida se cortó a mitad de un envío, la reserva vence a los 15 min. */
const RESERVA_VENCE_MS = 15 * 60 * 1000;

export interface Dependencias {
  enviar: (mail: Mail) => Promise<unknown>;
  pdf: (facturaId: number) => Promise<Buffer>;
  generarFacturas: (periodo: string, usuarioId?: number) => Promise<ResultadoFacturacion>;
  ahora: () => Date;
}

const DEPENDENCIAS_REALES: Dependencias = {
  enviar: enviarMail,
  pdf: generarPdfFactura,
  generarFacturas: (periodo, usuarioId) => generarFacturasPeriodo(periodo, { usuarioId }),
  ahora: () => new Date(),
};

export interface ResultadoRecordatorio {
  tipo: TipoRecordatorio;
  periodo: string;
  /** Solo en EMISION: resultado de generar las facturas del período. */
  facturacion: ResultadoFacturacion | null;
  facturas: number;
  enviados: number;
  /** Ya enviados en una corrida anterior (o en curso en otra). */
  yaEnviados: number;
  fallidos: number;
  /** Facturas de alumnos sin ningún padre activo vinculado. */
  sinDestinatario: number;
  errores: { facturaId: number; padreId: number; error: string }[];
}

// ---- Datos ------------------------------------------------------------------

const FACTURA_RECORDATORIO = {
  id: true,
  numero: true,
  periodo: true,
  vencimiento: true,
  total: true,
  estado: true,
  cuotas: {
    select: { concepto: true, descripcion: true, importe: true, estado: true },
    orderBy: [{ concepto: 'asc' as const }, { id: 'asc' as const }],
  },
  pagos: { select: { monto: true } },
  estudiante: {
    select: {
      nombre: true,
      padres: { select: { padre: { select: { id: true, nombre: true, email: true, isActive: true, role: true } } } },
    },
  },
} satisfies Prisma.FacturaSelect;

export type FacturaRecordatorio = Prisma.FacturaGetPayload<{ select: typeof FACTURA_RECORDATORIO }>;
type Padre = FacturaRecordatorio['estudiante']['padres'][number]['padre'];

const padresActivos = (f: FacturaRecordatorio): Padre[] =>
  f.estudiante.padres.map((l) => l.padre).filter((p) => p.isActive && p.role === Role.PADRE);

export const saldoDe = (f: Pick<FacturaRecordatorio, 'total' | 'pagos'>) =>
  sumar([f.total, sumar(f.pagos.map((p) => p.monto)).negated()]);

// ---- Contenido de los mails ----------------------------------------------------

type Item = FacturaRecordatorio['cuotas'][number];

// "Cuota mensual — Secundaria" ya dice el concepto; "Fútbol — Martes…" no.
export const textoItem = (c: Pick<Item, 'concepto' | 'descripcion'>) => {
  const label = CONCEPTO_LABEL[c.concepto];
  return c.descripcion.toLowerCase().startsWith(label.toLowerCase()) ? c.descripcion : `${label}: ${c.descripcion}`;
};

function lineasBancarias(): string[] {
  const b = datosBancarios();
  return [`Titular: ${b.titular}`, `CUIT: ${b.cuit}`, `CBU: ${b.cbu}`, `Alias: ${b.alias}`];
}

export function mailEmision(f: FacturaRecordatorio, padre: Padre, pdf: Buffer): Mail {
  const alumno = f.estudiante.nombre;
  const periodo = periodoLabel(f.periodo);
  const vence = fechaLarga(fechaISO(f.vencimiento));
  const detalle = f.cuotas.map((c): [string, string] => [textoItem(c), pesos(c.importe)]);
  const saludo = `Hola, ${padre.nombre}:`;
  const parrafos = [
    `Ya está disponible la factura N.º ${f.numero} de ${alumno}, correspondiente a ${periodo}. Vence el ${vence}.`,
    `${LEYENDA_TRANSFERENCIA} Podés pagar con estos datos y después cargar el comprobante desde la app: ${lineasBancarias().join(' · ')}.`,
    'Te adjuntamos la factura en PDF.',
  ];
  return {
    para: padre.email,
    asunto: `Factura de ${periodo} — ${alumno}`,
    texto: [
      saludo,
      '',
      parrafos[0],
      '',
      ...detalle.map(([concepto, importe]) => `- ${concepto}: ${importe}`),
      `Total: ${pesos(f.total)}`,
      '',
      LEYENDA_TRANSFERENCIA,
      ...lineasBancarias(),
      '',
      parrafos[2],
    ].join('\n'),
    html: htmlMail({ saludo, parrafos, detalle, destacado: ['Total a pagar', pesos(f.total)] }),
    adjuntos: [{ nombre: nombreArchivoFactura(f.numero), contenido: pdf }],
  };
}

export function mailDeuda(f: FacturaRecordatorio, padre: Padre, pdf: Buffer): Mail {
  const alumno = f.estudiante.nombre;
  const periodo = periodoLabel(f.periodo);
  const saldo = saldoDe(f);
  const pendientes = f.cuotas.filter((c) => c.estado !== EstadoCuota.PAGADA);
  const enRevision = pendientes.some((c) => c.estado === EstadoCuota.EN_REVISION);
  const detalle = pendientes.map((c): [string, string] => [
    `${textoItem(c)}${c.estado === EstadoCuota.EN_REVISION ? ' (comprobante en revisión)' : ''}`,
    pesos(c.importe),
  ]);
  const saludo = `Hola, ${padre.nombre}:`;
  const parrafos = [
    `Te recordamos que la factura N.º ${f.numero} de ${alumno} (${periodo}), vencida el ${fechaLarga(fechaISO(f.vencimiento))}, tiene un saldo pendiente de ${pesos(saldo)}.`,
    ...(enRevision
      ? ['Si ya cargaste el comprobante de algún ítem, está en revisión: no hace falta que vuelvas a pagarlo.']
      : []),
    `${LEYENDA_TRANSFERENCIA} Datos para transferir: ${lineasBancarias().join(' · ')}.`,
  ];
  return {
    para: padre.email,
    asunto: `Recordatorio de pago — ${alumno} (${periodo})`,
    texto: [
      saludo,
      '',
      ...parrafos,
      '',
      ...detalle.map(([concepto, importe]) => `- ${concepto}: ${importe}`),
      `Saldo pendiente: ${pesos(saldo)}`,
    ].join('\n'),
    html: htmlMail({ saludo, parrafos, detalle, destacado: ['Saldo pendiente', pesos(saldo)] }),
    adjuntos: [{ nombre: nombreArchivoFactura(f.numero), contenido: pdf }],
  };
}

// ---- Registro de envíos ------------------------------------------------------------

const esUnicoDuplicado = (err: unknown) => (err as { code?: string } | null)?.code === 'P2002';

/**
 * Reserva el envío (tipo, factura, padre) antes de mandarlo. Devuelve false
 * si ya se mandó o si otra corrida lo está mandando: así el job diario y el
 * botón del admin al mismo tiempo no duplican mails.
 */
async function reservarEnvio(tipo: TipoRecordatorio, facturaId: number, padreId: number, ahora: Date) {
  try {
    await prisma.envioRecordatorio.create({
      data: { tipo, facturaId, padreId, ok: false, error: EN_CURSO, enviadoEn: ahora },
    });
    return true;
  } catch (err) {
    if (!esUnicoDuplicado(err)) throw err;
  }
  // Ya había un registro: solo se reintenta si falló, o si quedó "en curso"
  // de una corrida que se cortó hace más de 15 minutos.
  const r = await prisma.envioRecordatorio.updateMany({
    where: {
      tipo,
      facturaId,
      padreId,
      ok: false,
      OR: [{ error: { not: EN_CURSO } }, { enviadoEn: { lt: new Date(ahora.getTime() - RESERVA_VENCE_MS) } }],
    },
    data: { error: EN_CURSO, enviadoEn: ahora },
  });
  return r.count === 1;
}

async function enviarRecordatorios(
  tipo: TipoRecordatorio,
  periodo: string,
  facturas: FacturaRecordatorio[],
  deps: Dependencias,
  facturacion: ResultadoFacturacion | null,
): Promise<ResultadoRecordatorio> {
  const resultado: ResultadoRecordatorio = {
    tipo,
    periodo,
    facturacion,
    facturas: facturas.length,
    enviados: 0,
    yaEnviados: 0,
    fallidos: 0,
    sinDestinatario: 0,
    errores: [],
  };
  const armar = tipo === TipoRecordatorio.EMISION ? mailEmision : mailDeuda;

  for (const factura of facturas) {
    const padres = padresActivos(factura);
    if (padres.length === 0) {
      resultado.sinDestinatario += 1;
      continue;
    }
    let pdf: Buffer | null = null; // uno por factura, aunque tenga varios padres

    for (const padre of padres) {
      if (!(await reservarEnvio(tipo, factura.id, padre.id, deps.ahora()))) {
        resultado.yaEnviados += 1;
        continue;
      }
      const clave = { tipo_facturaId_padreId: { tipo, facturaId: factura.id, padreId: padre.id } };
      try {
        pdf ??= await deps.pdf(factura.id);
        await deps.enviar(armar(factura, padre, pdf));
        await prisma.envioRecordatorio.update({
          where: clave,
          data: { ok: true, error: null, enviadoEn: deps.ahora() },
        });
        resultado.enviados += 1;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await prisma.envioRecordatorio.update({ where: clave, data: { ok: false, error: error.slice(0, 500) } });
        resultado.fallidos += 1;
        resultado.errores.push({ facturaId: factura.id, padreId: padre.id, error });
        logger.error('No se pudo enviar el recordatorio', { tipo, facturaId: factura.id, padreId: padre.id, error });
      }
    }
  }
  return resultado;
}

// ---- Jobs ----------------------------------------------------------------------------

/**
 * EMISION: genera las facturas del período (idempotente) y las manda por
 * mail. Con usuarioId (disparo manual del admin) la generación queda en la
 * auditoría a su nombre.
 */
export async function enviarEmision(
  periodo: string,
  opts: { usuarioId?: number } = {},
  deps: Dependencias = DEPENDENCIAS_REALES,
): Promise<ResultadoRecordatorio> {
  const facturacion = await deps.generarFacturas(periodo, opts.usuarioId);
  const facturas = await prisma.factura.findMany({
    where: { periodo },
    select: FACTURA_RECORDATORIO,
    orderBy: { id: 'asc' },
  });
  return enviarRecordatorios(TipoRecordatorio.EMISION, periodo, facturas, deps, facturacion);
}

/** DEUDA: facturas del período que no están pagas y tienen saldo pendiente. */
export async function enviarAvisoDeuda(
  periodo: string,
  deps: Dependencias = DEPENDENCIAS_REALES,
): Promise<ResultadoRecordatorio> {
  const candidatas = await prisma.factura.findMany({
    where: { periodo, estado: { in: [EstadoFactura.PENDIENTE, EstadoFactura.PARCIAL] } },
    select: FACTURA_RECORDATORIO,
    orderBy: { id: 'asc' },
  });
  const conSaldo = candidatas.filter((f) => saldoDe(f).greaterThan(CERO));
  return enviarRecordatorios(TipoRecordatorio.DEUDA, periodo, conSaldo, deps, null);
}

/** Qué le toca correr a una fecha ("AAAA-MM-DD", en Argentina). */
export function tareasDelDia(fecha: string): { tipo: TipoRecordatorio; periodo: string }[] {
  const tareas: { tipo: TipoRecordatorio; periodo: string }[] = [];
  const periodo = periodoDeFecha(fecha);
  if (esUltimoDiaHabil(fecha)) tareas.push({ tipo: TipoRecordatorio.EMISION, periodo: periodoSiguiente(periodo) });
  if (fecha.endsWith('-20')) tareas.push({ tipo: TipoRecordatorio.DEUDA, periodo });
  return tareas;
}

/** Punto de entrada del job diario (POST /api/jobs/diario). */
export async function ejecutarJobsDiarios(fecha: string = hoyArgentina(), deps: Dependencias = DEPENDENCIAS_REALES) {
  const resultados: ResultadoRecordatorio[] = [];
  for (const tarea of tareasDelDia(fecha)) {
    resultados.push(
      tarea.tipo === TipoRecordatorio.EMISION
        ? await enviarEmision(tarea.periodo, {}, deps)
        : await enviarAvisoDeuda(tarea.periodo, deps),
    );
  }
  logger.info('Jobs diarios ejecutados', {
    fecha,
    tareas: resultados.map((r) => ({ tipo: r.tipo, periodo: r.periodo, enviados: r.enviados, fallidos: r.fallidos })),
  });
  return { fecha, tareas: resultados };
}
