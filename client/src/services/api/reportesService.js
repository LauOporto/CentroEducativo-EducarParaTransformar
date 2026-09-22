import { httpClient, getToken } from './httpClient';

export const reportesService = {
  listar: () => httpClient.get('/api/reportes'),

  // Los reportes se descargan como binario (PDF), no como JSON — no se
  // puede usar httpClient.get (que siempre hace res.json()), así que
  // acá se arma un fetch autenticado aparte y se devuelve el blob.
  async descargarPdf(key, params = {}) {
    const qs = new URLSearchParams(params).toString();
    const res = await fetch(`/api/reportes/${key}/pdf${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || err.mensaje || 'No se pudo generar el reporte.');
    }
    return res.blob();
  },
};
