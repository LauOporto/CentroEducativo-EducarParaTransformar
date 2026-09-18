import { httpClient } from './httpClient';

export const inscripcionesService = {
  getResumen: (estudianteId) => httpClient.get(`/api/inscripciones/estudiantes/${estudianteId}/resumen`),

  inscribirDeporte: (estudianteId, grupoDeporteId) =>
    httpClient.post(`/api/inscripciones/estudiantes/${estudianteId}/deportes`, { grupoDeporteId }),
  desinscribirDeporte: (estudianteId, grupoDeporteId) =>
    httpClient.delete(`/api/inscripciones/estudiantes/${estudianteId}/deportes/${grupoDeporteId}`),

  setTransporte: (estudianteId, recorridoId) =>
    httpClient.put(`/api/inscripciones/estudiantes/${estudianteId}/transporte`, { recorridoId }),
  quitarTransporte: (estudianteId) =>
    httpClient.delete(`/api/inscripciones/estudiantes/${estudianteId}/transporte`),

  setComedor: (estudianteId, turnoId) =>
    httpClient.put(`/api/inscripciones/estudiantes/${estudianteId}/comedor`, { turnoId }),
  quitarComedor: (estudianteId) =>
    httpClient.delete(`/api/inscripciones/estudiantes/${estudianteId}/comedor`),
};
