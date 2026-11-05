import PDFDocument from 'pdfkit';
import { ConceptoCuota, EstadoFactura } from '@prisma/client';

import { env } from '../config/env';
import { prisma } from '../db/prisma';
import { CURSO_SELECT } from '../utils/cursoLabel';
import { HttpError } from '../utils/httpError';
import { formatearPesos, sumar } from '../utils/montos';
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

export const CONCEPTO_LABEL: Record<ConceptoCuota, string> = {
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

export const pesos = formatearPesos;
export const fechaLarga = (iso: string) => iso.split('-').reverse().join('/');
export const periodoLabel = (periodo: string) => {
  const [anio, mes] = periodo.split('-').map(Number);
  return `${MESES[mes - 1]} ${anio}`;
};

// Tabla de ítems con alto de fila variable: la descripción de un deporte
// ("Fútbol — Secundaria — Martes 15:00 a 16:30 — Prof. …") puede ocupar dos
// líneas, y el helper tabla() de los reportes avanza siempre una línea fija.
// La comparten la factura y el comprobante de pago.
export interface ColumnasTabla {
  titulos: string[];
  anchos: number[];
  derecha: number[]; // índices de columnas alineadas a la derecha (importes)
}

const COLUMNAS_FACTURA: ColumnasTabla = {
  titulos: ['Concepto', 'Descripción', 'Importe', 'Estado'],
  anchos: [70, 285, 85, 75],
  derecha: [2],
};

export function tablaItems(doc: PDFKit.PDFDocument, columnas: ColumnasTabla, filas: string[][]) {
  const { anchos } = columnas;
  const x0 = margenIzquierdo(doc);
  const ancho = anchos.reduce((a, b) => a + b, 0);
  const fila = (valores: string[], fuente: string) => {
    doc.font(fuente).fontSize(9.5).fillColor(COLOR_TEXTO);
    const alto = Math.max(...valores.map((v, i) => doc.heightOfString(v, { width: anchos[i] - 6 })));
    if (doc.y + alto > doc.page.height - doc.page.margins.bottom) doc.addPage();
    const y = doc.y;
    let x = x0;
    valores.forEach((v, i) => {
      doc.text(v, x, y, { width: anchos[i] - 6, align: columnas.derecha.includes(i) ? 'right' : 'left' });
      x += anchos[i];
    });
    doc.y = y + alto + 4;
    doc
      .moveTo(x0, doc.y - 2)
      .lineTo(x0 + ancho, doc.y - 2)
      .strokeColor('#e2e8f0')
      .lineWidth(0.5)
      .stroke();
  };
  fila(columnas.titulos, 'Helvetica-Bold');
  filas.forEach((f) => fila(f, 'Helvetica'));
  doc.font('Helvetica');
  doc.x = x0;
}

// Documento A4 que junta los chunks y resuelve con el Buffer al terminar.
export function nuevoDocumentoPdf() {
  const doc = new PDFDocument({ size: 'A4', margin: 40 });
  const partes: Buffer[] = [];
  doc.on('data', (chunk: Buffer) => partes.push(chunk));
  const terminado = new Promise<Buffer>((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);
  });
  return { doc, terminado };
}

// Totales alineados a la derecha (Total / Pagado / Saldo, o solo Total).
export function bloqueTotales(doc: PDFKit.PDFDocument, filas: [string, string, boolean][]) {
  const xTotales = margenIzquierdo(doc) + 300;
  for (const [etiqueta, valor, negrita] of filas) {
    const y = doc.y;
    doc
      .font(negrita ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(11)
      .fillColor(COLOR_TEXTO);
    doc.text(etiqueta, xTotales, y, { width: 100 });
    doc.text(valor, xTotales + 100, y, { width: 115, align: 'right' });
  }
  doc.font('Helvetica');
}

// Recuadro con los datos para transferir. instrucciones (opcional) se agrega
// antes de la leyenda; el alto se ajusta al contenido.
export function cajaDatosBancarios(doc: PDFKit.PDFDocument, instrucciones?: string) {
  const banco = datosBancarios();
  const x0 = margenIzquierdo(doc);
  doc.moveDown(1.2);
  const anchoCaja = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  if (doc.y + (instrucciones ? 140 : 104) > doc.page.height - doc.page.margins.bottom) doc.addPage();
  const yCaja = doc.y;
  const xi = x0 + 12;
  const anchoTexto = anchoCaja - 24;
  doc
    .fontSize(12)
    .fillColor(COLOR_TITULO)
    .text('Datos para transferencia', xi, yCaja + 10, { width: anchoTexto });
  doc.fontSize(10).fillColor(COLOR_TEXTO);
  doc.text(`Titular: ${banco.titular}`, xi, doc.y + 4, { width: anchoTexto });
  doc.text(`CUIT: ${banco.cuit}`, xi, doc.y, { width: anchoTexto });
  doc.text(`CBU: ${banco.cbu}`, xi, doc.y, { width: anchoTexto });
  doc.text(`Alias: ${banco.alias}`, xi, doc.y, { width: anchoTexto });
  if (instrucciones) doc.text(instrucciones, xi, doc.y + 4, { width: anchoTexto });
  doc
    .font('Helvetica-Bold')
    .fillColor(COLOR_MUTED)
    .text(LEYENDA_TRANSFERENCIA, xi, doc.y + 4, { width: anchoTexto });
  doc.font('Helvetica');
  const altoCaja = Math.max(104, doc.y - yCaja + 10);
  doc.roundedRect(x0, yCaja, anchoCaja, altoCaja, 6).strokeColor(COLOR_TITULO).lineWidth(1).stroke();
  doc.y = yCaja + altoCaja + 10;
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

  const { doc, terminado } = nuevoDocumentoPdf();

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
    COLUMNAS_FACTURA,
    factura.cuotas.map((c) => [
      CONCEPTO_LABEL[c.concepto],
      c.descripcion,
      pesos(c.importe),
      ESTADO_ITEM_LABEL[estadoItem(c.estado, c.vencimiento, hoy)],
    ]),
  );

  doc.moveDown(0.6);
  bloqueTotales(doc, [
    ['Total', pesos(factura.total), true],
    ['Pagado', pesos(pagado), false],
    ['Saldo', pesos(saldo), true],
  ]);

  cajaDatosBancarios(doc);

  doc.end();
  return terminado;
}
