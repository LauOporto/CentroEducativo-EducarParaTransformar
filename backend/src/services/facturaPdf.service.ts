import PDFDocument from 'pdfkit';
import { ConceptoCuota, EstadoFactura } from '@prisma/client';

import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { CURSO_SELECT } from '../utils/cursoLabel';
import { HttpError } from '../utils/httpError';
import { sumar, toMonto, type MontoEntrada } from '../utils/montos';
import { fechaISO, hoyArgentina } from '../utils/fechas';
import { estadoItem, type EstadoItemVista } from './pagos.facade';
import {
  COLOR_MUTED,
  COLOR_TEXTO,
  COLOR_TITULO,
  encabezadoReporte,
  margenIzquierdo,
  seccion,
} from './reportes/pdfHelpers';

// Factura en PDF (RF-49): la descarga el padre desde la app o el web, y en
// F9 se adjunta al mail de emisión. Reutiliza el layout del motor de
// reportes (pdfHelpers) para que todos los PDF del sistema se vean igual.

export function datosBancarios() {
  return { titular: env.BANCO_TITULAR, cuit: env.BANCO_CUIT, cbu: env.BANCO_CBU, alias: env.BANCO_ALIAS };
}

export const LEYENDA_TRANSFERENCIA = 'Solo se aceptan pagos por transferencia bancaria.';

const CONCEPTO_LABEL: Record<ConceptoCuota, string> = {
  CUOTA: 'Cuota',
  DEPORTE: 'Deporte',
  TRANSPORTE: 'Transporte',
  COMEDOR: 'Comedor',
};
const ESTADO_ITEM_LABEL: Record<EstadoItemVista, string> = {
  PENDIENTE: 'Pendiente',
  EN_REVISION: 'En revisión',
  PAGADA: 'Pagada',
  VENCIDA: 'Vencida',
};
const ESTADO_FACTURA_LABEL: Record<EstadoFactura, string> = {
  PENDIENTE: 'Pendiente',
  PARCIAL: 'Pago parcial',
  PAGADA: 'Pagada',
};
const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const pesos = (v: MontoEntrada) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(toMonto(v));
const fechaLarga = (iso: string) => iso.split('-').reverse().join('/');
const periodoLabel = (periodo: string) => {
  const [anio, mes] = periodo.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
};

// Tabla de ítems con alto de fila variable: la descripción de un deporte
// ("Fútbol — Secundaria — Martes 15:00 a 16:30 — Prof. …") puede ocupar dos
// líneas, y el helper tabla() de los reportes avanza siempre una línea fija.
const COLUMNAS_ITEMS = ['Concepto', 'Descripción', 'Importe', 'Estado'];
const ANCHOS_ITEMS = [70, 285, 85, 75];

function tablaItems(doc: PDFKit.PDFDocument, filas: string[][]) {
  const x0 = margenIzquierdo(doc);
  const ancho = ANCHOS_ITEMS.reduce((a, b) => a + b, 0);
  const fila = (valores: string[], fuente: string) => {
    doc.font(fuente).fontSize(9.5).fillColor(COLOR_TEXTO);
    const alto = Math.max(...valores.map((v, i) => doc.heightOfString(v, { width: ANCHOS_ITEMS[i] - 6 })));
    if (doc.y + alto > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    let x = x0;
    valores.forEach((v, i) => {
      doc.text(v, x, y, { width: ANCHOS_ITEMS[i] - 6, align: i === 2 ? 'right' : 'left' });
      x += ANCHOS_ITEMS[i];
    });
    doc.y = y + alto + 4;
    doc
      .moveTo(x0, doc.y - 2)
      .lineTo(x0 + ancho, doc.y - 2)
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .stroke();
  };
  fila(COLUMNAS_ITEMS, 'Helvetica-Bold');
  filas.forEach((f) => fila(f, 'Helvetica'));
  doc.font('Helvetica');
  doc.x = x0;
}

export function nombreArchivoFactura(numero: string) {
  return `factura-${numero}.pdf`;
}

export async function generarPdfFactura(facturaId: number): Promise<Buffer> {
  const factura = await prisma.factura.findUnique({
    where: { id: facturaId },
    include: {
      cuotas: { orderBy: [{ concepto: 'asc' }, { id: 'asc' }] },
      pagos: { select: { monto: true } },
      estudiante: { select: { nombre: true, apellido: true, legajo: true, curso: { select: CURSO_SELECT } } },
    },
  });
  if (!factura) throw HttpError.notFound('La factura indicada no existe.');

  const hoy = hoyArgentina();
  const pagado = sumar(factura.pagos.map((p) => p.monto));
  const saldo = sumar([factura.total, pagado.negated()]);

  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const partes: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => partes.push(chunk));
  const terminado = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });

  const x0 = margenIzquierdo(doc);
  encabezadoReporte(doc, `Factura N.º ${factura.numero}`, `Período ${periodoLabel(factura.periodo)}`);

  doc.fontSize(10).fillColor(COLOR_TEXTO);
  doc.text(
    `Emisión: ${fechaLarga(fechaISO(factura.emitidaEn))}    Vencimiento: ${fechaLarga(fechaISO(factura.vencimiento))}`,
    x0,
    doc.y,
  );
  doc.text(`Estado: ${ESTADO_FACTURA_LABEL[factura.estado]}`, x0, doc.y);

  seccion(doc, 'Alumno');
  const e = factura.estudiante;
  doc.text(`${e.nombre}${e.legajo ? ` — Legajo ${e.legajo}` : ''}`, x0, doc.y);
  doc.text(`Curso: ${e.curso?.nombre ?? '—'}    Nivel: ${e.curso?.nivel.nombre ?? '—'}`, x0, doc.y);

  seccion(doc, 'Detalle');
  tablaItems(
    doc,
    factura.cuotas.map((c) => [
      CONCEPTO_LABEL[c.concepto],
      c.descripcion,
      pesos(c.importe),
      ESTADO_ITEM_LABEL[estadoItem(c.estado, c.vencimiento, hoy)],
    ]),
  );

  doc.moveDown(0.6);
  const xTotales = x0 + 300;
  for (const [etiqueta, valor, negrita] of [
    ['Total', factura.total, true],
    ['Pagado', pagado, false],
    ['Saldo', saldo, true],
  ] as const) {
    const y = doc.y;
    doc
      .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(11)
      .fillColor(COLOR_TEXTO);
    doc.text(etiqueta, xTotales, y, { width: 100 });
    doc.text(pesos(valor), xTotales + 100, y, { width: 115, align: 'right' });
  }
  doc.font('Helvetica');

  // Recuadro con los datos para transferir.
  const banco = datosBancarios();
  doc.moveDown(1.2);
  const yCaja = doc.y;
  const anchoCaja = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const altoCaja = 104;
  doc.roundedRect(x0, yCaja, anchoCaja, altoCaja, 6).strokeColor(COLOR_TITULO).lineWidth(1).stroke();
  const xi = x0 + 12;
  doc
    .fontSize(12)
    .fillColor(COLOR_TITULO)
    .text('Datos para transferencia', xi, yCaja + 10);
  doc.fontSize(10).fillColor(COLOR_TEXTO);
  doc.text(`Titular: ${banco.titular}`, xi, doc.y + 4);
  doc.text(`CUIT: ${banco.cuit}`, xi, doc.y);
  doc.text(`CBU: ${banco.cbu}`, xi, doc.y);
  doc.text(`Alias: ${banco.alias}`, xi, doc.y);
  doc
    .font('Helvetica-Bold')
    .fillColor(COLOR_MUTED)
    .text(LEYENDA_TRANSFERENCIA, xi, doc.y + 4);
  doc.font('Helvetica');
  doc.y = yCaja + altoCaja + 10;
  doc.x = x0;

  doc.end();
  return terminado;
}
