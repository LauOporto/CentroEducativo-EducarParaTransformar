import { Platform } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { File } from 'expo-file-system';
import type { QueryClient } from '@tanstack/react-query';
import { api, apiMultipart, descargarArchivo } from '@/lib/api';
import type { Rango } from './rango';
import type {
  EstadoCuenta,
  RespuestaAnular,
  RespuestaArchivo,
  RespuestaComprobante,
  RespuestaFactura,
  RespuestaTransferencia,
} from './tipos';

// Endpoints de /api/pagos que usa la app (contrato en PLAN_PARTE3, sección 4).

export const clavesPagos = {
  /** Prefijo: invalida el estado de cuenta del hijo en todos los rangos. */
  estadoCuentaDe: (hijoId: number) => ['estado-cuenta', hijoId] as const,
  estadoCuenta: (hijoId: number, desde: string, hasta: string) => ['estado-cuenta', hijoId, desde, hasta] as const,
  factura: (id: number) => ['factura', id] as const,
  comprobante: (id: number) => ['comprobante', id] as const,
};

/**
 * RNF-57: después de cada mutación se releen el estado de cuenta del hijo, la
 * factura y el comprobante involucrados, así ninguna pantalla queda con datos
 * viejos.
 */
export function invalidarPagos(
  queryClient: QueryClient,
  { hijoId, facturaId, comprobanteId }: { hijoId?: number; facturaId?: number; comprobanteId?: number },
) {
  return Promise.all([
    hijoId !== undefined ? queryClient.invalidateQueries({ queryKey: clavesPagos.estadoCuentaDe(hijoId) }) : null,
    facturaId !== undefined ? queryClient.invalidateQueries({ queryKey: clavesPagos.factura(facturaId) }) : null,
    comprobanteId !== undefined
      ? queryClient.invalidateQueries({ queryKey: clavesPagos.comprobante(comprobanteId) })
      : null,
  ]);
}

export type TipoArchivo = 'image/jpeg' | 'image/png' | 'application/pdf';

/** Archivo elegido con la cámara, la galería o el selector de documentos. */
export type ArchivoElegido = { uri: string; nombre: string; tipo: TipoArchivo; tamano?: number };

export type DatosTransferencia = {
  archivo: ArchivoElegido;
  nroOperacion: string;
  /** AAAA-MM-DD */
  fechaTransferencia: string;
  /** Con punto decimal, por ejemplo "290000.00". */
  montoTransferido: string;
};

/** Único medio admitido (regla de negocio): la app no ofrece otro. */
export const MEDIO_PAGO = 'TRANSFERENCIA';

export async function armarFormularioTransferencia(datos: DatosTransferencia): Promise<FormData> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(datos.archivo.uri)).blob();
    form.append('archivo', new Blob([blob], { type: datos.archivo.tipo }), datos.archivo.nombre);
  } else {
    // Desde el SDK 58 el fetch global es expo/fetch, que NO admite la forma
    // clásica de React Native { uri, name, type }: tira "Unsupported
    // FormDataPart implementation" antes de mandar nada (la app lo mostraba
    // como "sin conexión"). Serializa cualquier parte con name/type/bytes(),
    // así que se lee el archivo local con expo-file-system. El tipo se fija
    // explícito porque el backend exige que coincida con el contenido real.
    const { uri, nombre, tipo } = datos.archivo;
    form.append('archivo', {
      name: nombre,
      type: tipo,
      bytes: () => new File(uri).bytes(),
    } as unknown as Blob);
  }
  form.append('nroOperacion', datos.nroOperacion);
  form.append('fechaTransferencia', datos.fechaTransferencia);
  form.append('montoTransferido', datos.montoTransferido);
  form.append('medio', MEDIO_PAGO);
  return form;
}

export const pagosApi = {
  estadoCuenta: (hijoId: number, { desde, hasta }: Rango) =>
    api<EstadoCuenta>(`/pagos/hijos/${hijoId}/estado-cuenta?desde=${desde}&hasta=${hasta}`),

  factura: (id: number) => api<RespuestaFactura>(`/pagos/facturas/${id}`),

  generarComprobante: (facturaId: number, cuotaIds: number[]) =>
    api<RespuestaComprobante>('/pagos/comprobantes', { method: 'POST', body: { facturaId, cuotaIds } }),

  comprobante: (id: number) => api<RespuestaComprobante>(`/pagos/comprobantes/${id}`),

  anular: (id: number) => api<RespuestaAnular>(`/pagos/comprobantes/${id}/anular`, { method: 'POST' }),

  cargarTransferencia: async (id: number, datos: DatosTransferencia) =>
    apiMultipart<RespuestaTransferencia>(
      `/pagos/comprobantes/${id}/transferencia`,
      await armarFormularioTransferencia(datos),
    ),

  urlArchivo: (id: number) => api<RespuestaArchivo>(`/pagos/comprobantes/${id}/archivo`),

  descargarFacturaPdf: (id: number, numero: string) =>
    descargarArchivo(`/pagos/facturas/${id}/pdf`, `factura-${numero}.pdf`),

  descargarComprobantePdf: (id: number, numero: string) =>
    descargarArchivo(`/pagos/comprobantes/${id}/pdf`, `comprobante-${numero}.pdf`),
};

/**
 * Muestra un PDF descargado: en el celular abre la hoja de compartir del
 * sistema (guardar, abrir con un visor, mandar por WhatsApp…); en la versión
 * web lo abre en una pestaña nueva.
 */
export async function compartirPdf(uri: string, titulo: string): Promise<void> {
  if (Platform.OS === 'web') {
    globalThis.open?.(uri, '_blank');
    return;
  }
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Este dispositivo no permite compartir archivos.');
  }
  await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: titulo });
}

/** Abre la URL firmada (5 min) del archivo de la transferencia en el navegador del sistema. */
export async function verArchivoCargado(comprobanteId: number): Promise<void> {
  const { url } = await pagosApi.urlArchivo(comprobanteId);
  await WebBrowser.openBrowserAsync(url);
}
