import { EstadoComprobante } from '@prisma/client';

import { fechaISO, hoyArgentina } from '../utils/fechas';
import { COLOR_TEXTO, encabezadoReporte, margenIzquierdo, seccion } from './reportes/pdfHelpers';
import { buscarComprobante, instruccionesTransferencia } from './comprobantes.service';
import {
  CONCEPTO_LABEL,
  bloqueTotales,
  cajaDatosBancarios,
  fechaLarga,
  nuevoDocumentoPdf,
  periodoLabel,
  pesos,
  tablaItems,
  type ColumnasTabla,
} from './facturaPdf.service';

// Comprobante de pago en PDF (RF-50, D5 paso 2): el padre lo descarga al
// generarlo y lo usa para transferir. Mismo layout y tabla que la factura.

export const ESTADO_COMPROBANTE_LABEL: Record<EstadoComprobante, string> = {
  GENERADO: 'Generado — pendiente de transferencia',
  EN_REVISION: 'Transferencia en revisión',
  APROBADO: 'Aprobado — pago acreditado',
  RECHAZADO: 'Rechazado',
  ANULADO: 'Anulado',
};

const COLUMNAS_COMPROBANTE: ColumnasTabla = {
  titulos: ['Concepto', 'Descripción', 'Importe'],
  anchos: [80, 345, 90],
  derecha: [2],
};

export const nombreArchivoComprobante = (numero: string) => `comprobante-${numero}.pdf`;

export async function generarPdfComprobante(id: number): Promise<Buffer> {
  const c = await buscarComprobante(id);
  const { doc, terminado } = nuevoDocumentoPdf();
  const x0 = margenIzquierdo(doc);

  encabezadoReporte(doc, `Comprobante de pago N.º ${c.numero}`, `Factura ${c.factura.numero}`);

  doc.fontSize(10).fillColor(COLOR_TEXTO);
  doc.text(`Fecha: ${fechaLarga(hoyArgentina(c.createdAt))}    Medio de pago: Transferencia bancaria`, x0, doc.y);
  doc.text(`Estado: ${ESTADO_COMPROBANTE_LABEL[c.estado]}`, x0, doc.y);
  if (c.estado === EstadoComprobante.RECHAZADO && c.motivoRechazo) {
    doc.text(`Motivo del rechazo: ${c.motivoRechazo}`, x0, doc.y);
  }

  seccion(doc, 'Alumno');
  const e = c.factura.estudiante;
  doc.text(`${e.nombre}${e.legajo ? ` — Legajo ${e.legajo}` : ''}`, x0, doc.y);
  doc.text(`Curso: ${e.curso?.nombre ?? '—'}    Nivel: ${e.curso?.nivel.nombre ?? '—'}`, x0, doc.y);

  seccion(doc, 'Factura');
  doc.text(
    `N.º ${c.factura.numero} — Período ${periodoLabel(c.factura.periodo)} — Vencimiento ${fechaLarga(fechaISO(c.factura.vencimiento))}`,
    x0,
    doc.y,
  );

  seccion(doc, 'Ítems que se pagan');
  tablaItems(
    doc,
    COLUMNAS_COMPROBANTE,
    c.items.map((i) => [CONCEPTO_LABEL[i.cuota.concepto], i.cuota.descripcion, pesos(i.importe)]),
  );

  doc.moveDown(0.6);
  bloqueTotales(doc, [['Total a transferir', pesos(c.total), true]]);

  if (c.cargadoEn && c.nroOperacion) {
    seccion(doc, 'Transferencia informada');
    doc.text(
      `N.º de operación: ${c.nroOperacion}    Fecha: ${c.fechaTransferencia ? fechaLarga(fechaISO(c.fechaTransferencia)) : '—'}    Monto: ${c.montoTransferido ? pesos(c.montoTransferido) : '—'}`,
      x0,
      doc.y,
    );
  }

  cajaDatosBancarios(doc, instruccionesTransferencia(c.total, c.numero));

  doc.end();
  return terminado;
}
