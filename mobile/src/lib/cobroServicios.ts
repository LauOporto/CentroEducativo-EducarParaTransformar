import { MESES, periodoLargo, pesos } from '@/pagos/formato';

// Cómo se cobra un servicio (deporte, transporte, comedor): no hay cobro en
// el momento de inscribir. El último día hábil de cada mes el backend emite la
// factura del mes siguiente con lo que el alumno tenga activo ese día
// (recordatorios.service → generarFacturasPeriodo), así que una alta de hoy
// entra en la factura del mes que viene y la factura ya emitida no cambia.

/** "2026-11-09" → "2026-12" */
export function periodoSiguiente(hoy: string): string {
  const anio = Number(hoy.slice(0, 4));
  const mes = Number(hoy.slice(5, 7));
  return mes === 12 ? `${anio + 1}-01` : `${anio}-${String(mes + 1).padStart(2, '0')}`;
}

/** Texto de la confirmación de alta o cambio: cuánto cuesta y desde qué factura se cobra. */
export function mensajeCobro(precioMensual: number, hoy: string): string {
  if (precioMensual <= 0) {
    return 'Por ahora no tiene costo: la escuela todavía no fijó su precio.';
  }
  const mesActual = MESES[Number(hoy.slice(5, 7)) - 1]?.toLowerCase() ?? '';
  return (
    `Cuesta ${pesos(precioMensual)} por mes. No se paga ahora: se suma a la factura de ` +
    `${periodoLargo(periodoSiguiente(hoy)).toLowerCase()}, que se emite el último día hábil de ${mesActual}. ` +
    'Las facturas ya emitidas no cambian.'
  );
}
