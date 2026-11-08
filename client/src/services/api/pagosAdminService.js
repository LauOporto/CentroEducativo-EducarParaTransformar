import { httpClient, getToken } from './httpClient';

// Panel de pagos del administrador (RF-50): revisión de comprobantes,
// precios y facturación. Los errores del backend llegan como
// { error, message } sin `exito`; las pantallas muestran `message`.

function qs(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const pagosAdminService = {
  // Bandeja: { exito, total, limit, offset, comprobantes[] }
  listarComprobantes: ({ estado, estudianteId, desde, hasta, limit, offset } = {}) =>
    httpClient.get(`/api/admin/pagos/comprobantes${qs({ estado, estudianteId, desde, hasta, limit, offset })}`),

  aprobar: (id, fechaAcreditacion) =>
    httpClient.post(`/api/admin/pagos/comprobantes/${id}/aprobar`, fechaAcreditacion ? { fechaAcreditacion } : {}),

  rechazar: (id, motivo) => httpClient.post(`/api/admin/pagos/comprobantes/${id}/rechazar`, { motivo }),

  // { exito, url, expiraEn } — URL firmada de corta vida.
  urlArchivo: (id) => httpClient.get(`/api/pagos/comprobantes/${id}/archivo`),

  // El PDF es binario: no pasa por httpClient (que siempre hace res.json()).
  async descargarPdf(id) {
    const res = await fetch(`/api/pagos/comprobantes/${id}/pdf`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.mensaje || 'No se pudo descargar el PDF.');
    }
    return res.blob();
  },

  // Precios: cada uno responde { exito, nivel | deporte | recorrido | turno }.
  fijarCuotaNivel: (id, precio) => httpClient.put(`/api/niveles/${id}/cuota`, { precio }),
  fijarPrecioDeporte: (id, precio) => httpClient.put(`/api/deportes/${id}/precio`, { precio }),
  fijarPrecioRecorrido: (id, precio) => httpClient.put(`/api/transporte/${id}/precio`, { precio }),
  fijarPrecioTurno: (id, precio) => httpClient.put(`/api/comedor/${id}/precio`, { precio }),

  // { exito, periodo, creadas, omitidas, detalleOmitidas[] }
  generarFacturas: (periodo) => httpClient.post('/api/admin/facturacion/generar', { periodo }),
};
