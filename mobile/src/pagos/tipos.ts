// Respuestas de /api/pagos (RF-49 y RF-50), copiadas del contrato de
// PLAN_PARTE3 (sección 4, F2, F3 y F5) y de las respuestas reales del backend
// (pagos.facade.ts y comprobantes.service.ts). Montos: number con 2
// decimales. Vencimientos y fechas de negocio: "AAAA-MM-DD"; instantes: ISO
// 8601 en UTC.

export type Concepto = 'CUOTA' | 'DEPORTE' | 'TRANSPORTE' | 'COMEDOR';

/** VENCIDA no se guarda: el backend la calcula (PENDIENTE con vencimiento anterior a hoy). */
export type EstadoItem = 'PENDIENTE' | 'VENCIDA' | 'EN_REVISION' | 'PAGADA';

export type EstadoFactura = 'PENDIENTE' | 'PARCIAL' | 'PAGADA';

export type EstadoComprobante = 'GENERADO' | 'EN_REVISION' | 'APROBADO' | 'RECHAZADO' | 'ANULADO';

export type AlumnoPagos = { id: number; nombre: string; curso: string | null };

export type ItemFactura = {
  id: number;
  concepto: Concepto;
  descripcion: string;
  importe: number;
  vencimiento: string;
  estado: EstadoItem;
};

/** Comprobante tal como viene dentro de una factura (versión corta). */
export type ComprobanteDeFactura = {
  id: number;
  numero: string;
  total: number;
  estado: EstadoComprobante;
  nroOperacion: string | null;
  cargadoEn: string | null;
  motivoRechazo: string | null;
  tieneArchivo: boolean;
};

export type Factura = {
  id: number;
  numero: string;
  /** "AAAA-MM" */
  periodo: string;
  emitidaEn: string;
  vencimiento: string;
  total: number;
  pagado: number;
  saldo: number;
  estado: EstadoFactura;
  items: ItemFactura[];
  comprobantes: ComprobanteDeFactura[];
};

export type PagoAcreditado = {
  id: number;
  fechaAcreditacion: string;
  monto: number;
  comprobanteNumero: string;
  facturaNumero: string;
  periodo: string;
};

export type ResumenCuenta = {
  totalAdeudado: number;
  totalVencido: number;
  totalEnRevision: number;
  totalPagado: number;
  deudaPorConcepto: Record<Concepto, number>;
};

/** GET /pagos/hijos/:id/estado-cuenta */
export type EstadoCuenta = {
  exito: true;
  alumno: AlumnoPagos;
  rango: { desde: string; hasta: string };
  resumen: ResumenCuenta;
  facturas: Factura[];
  pagos: PagoAcreditado[];
};

/** GET /pagos/facturas/:id: la factura tiene la misma forma que en el estado de cuenta. */
export type RespuestaFactura = { exito: true; alumno: AlumnoPagos; factura: Factura };

export type ItemComprobante = { cuotaId: number; concepto: Concepto; descripcion: string; importe: number };

export type Comprobante = {
  id: number;
  numero: string;
  estado: EstadoComprobante;
  medio: 'TRANSFERENCIA';
  total: number;
  generadoEn: string;
  items: ItemComprobante[];
  factura: { id: number; numero: string; periodo: string; vencimiento: string; estado: EstadoFactura };
  alumno: AlumnoPagos;
  padre: { id: number; nombre: string };
  transferencia: {
    nroOperacion: string | null;
    fechaTransferencia: string | null;
    montoTransferido: number | null;
    cargadoEn: string;
  } | null;
  tieneArchivo: boolean;
  motivoRechazo: string | null;
  revisadoEn: string | null;
  pago: { id: number; monto: number; fechaAcreditacion: string } | null;
};

export type DatosBancarios = { titular: string; cuit: string; cbu: string; alias: string };

/** POST /pagos/comprobantes (201) y GET /pagos/comprobantes/:id */
export type RespuestaComprobante = {
  exito: true;
  comprobante: Comprobante;
  datosBancarios: DatosBancarios;
  instrucciones: string;
};

/** POST /pagos/comprobantes/:id/anular */
export type RespuestaAnular = { exito: true; comprobante: Comprobante };

/** POST /pagos/comprobantes/:id/transferencia */
export type RespuestaTransferencia = { exito: true; mensaje: string; comprobante: Comprobante };

/** GET /pagos/comprobantes/:id/archivo: URL firmada que vence a los 5 minutos. */
export type RespuestaArchivo = { exito: true; url: string; expiraEn: string };
