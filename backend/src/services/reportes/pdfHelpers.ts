// Helpers de layout compartidos por todas las estrategias del Motor de
// Reportes. Ver porAlumno.strategy.ts para el porqué del manejo de
// doc.x: pdfkit deja el cursor x clavado en la última columna dibujada
// con coordenadas explícitas, así que cualquier texto de flujo libre
// posterior tiene que reestablecerlo al margen antes de escribir.

export const COLOR_TITULO = '#1d4ed8';
export const COLOR_TEXTO = '#1e293b';
export const COLOR_MUTED = '#64748b';

export function margenIzquierdo(doc: PDFKit.PDFDocument) {
  return doc.page.margins.left;
}

function anchoDisponible(doc: PDFKit.PDFDocument) {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

export function encabezadoReporte(doc: PDFKit.PDFDocument, titulo: string, subtitulo?: string) {
  const x0 = margenIzquierdo(doc);
  doc.fontSize(18).fillColor(COLOR_TITULO).text(titulo, x0, doc.y);
  doc.fontSize(9).fillColor(COLOR_MUTED).text('Educar para Transformar — Sistema de Gestión', x0, doc.y);
  if (subtitulo) doc.text(subtitulo, x0, doc.y);
  doc.text(`Generado el ${new Date().toLocaleString('es-AR')}`, x0, doc.y);
  const yLinea = doc.y + 6;
  doc.moveTo(x0, yLinea).lineTo(x0 + anchoDisponible(doc), yLinea).strokeColor('#94a3b8').stroke();
  doc.y = yLinea + 10;
  doc.x = x0;
}

export function seccion(doc: PDFKit.PDFDocument, titulo: string) {
  const x0 = margenIzquierdo(doc);
  doc.x = x0;
  doc.moveDown(0.8);
  doc.fontSize(13).fillColor(COLOR_TITULO).text(titulo, x0, doc.y);
  const yLinea = doc.y + 2;
  doc.moveTo(x0, yLinea).lineTo(x0 + anchoDisponible(doc), yLinea).strokeColor('#cbd5e1').stroke();
  doc.y = yLinea + 8;
  doc.x = x0;
  doc.fontSize(10).fillColor(COLOR_TEXTO);
}

// Tabla con encabezado repetido en cada página nueva (para listados
// largos, ej. "Listado de alumnos por curso" con toda la matrícula).
export function tabla(
  doc: PDFKit.PDFDocument,
  columnas: string[],
  anchos: number[],
  filas: string[][],
  opts: { filaAltura?: number } = {},
) {
  const x0 = margenIzquierdo(doc);
  const filaAltura = opts.filaAltura ?? 16;
  const limiteInferior = doc.page.height - doc.page.margins.bottom;

  const dibujarEncabezado = () => {
    let x = x0;
    const y = doc.y;
    doc.font('Helvetica-Bold').fontSize(9.5).fillColor(COLOR_TEXTO);
    columnas.forEach((c, i) => {
      doc.text(c, x, y, { width: anchos[i] });
      x += anchos[i];
    });
    doc.moveDown(0.3);
    doc.moveTo(x0, doc.y).lineTo(x0 + anchos.reduce((a, b) => a + b, 0), doc.y).strokeColor('#e2e8f0').stroke();
    doc.moveDown(0.2);
    doc.x = x0;
  };

  dibujarEncabezado();

  if (filas.length === 0) {
    doc.font('Helvetica-Oblique').fillColor(COLOR_MUTED).fontSize(9.5).text('Sin datos.', x0, doc.y);
    doc.moveDown(0.3);
    doc.x = x0;
    return;
  }

  filas.forEach((fila) => {
    if (doc.y + filaAltura > limiteInferior) {
      doc.addPage();
      doc.x = x0;
      dibujarEncabezado();
    }
    let x = x0;
    const y = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor(COLOR_TEXTO);
    fila.forEach((v, i) => {
      doc.text(v, x, y, { width: anchos[i] });
      x += anchos[i];
    });
    doc.moveDown(0.3);
  });

  doc.x = x0;
}
