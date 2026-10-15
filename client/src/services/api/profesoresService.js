import { httpClient } from './httpClient';

export const profesoresService = {
  // Admin
  list: ({ q, estado, nivelId } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (estado) params.set('estado', estado);
    if (nivelId) params.set('nivelId', nivelId);
    const qs = params.toString();
    return httpClient.get(`/api/profesores${qs ? `?${qs}` : ''}`);
  },
  get: (id) => httpClient.get(`/api/profesores/${id}`),
  asignarMateria: (id, payload) => httpClient.post(`/api/profesores/${id}/materias`, payload),
  quitarMateria: (id, asignacionId) => httpClient.delete(`/api/profesores/${id}/materias/${asignacionId}`),

  // Docente (autoservicio)
  me: () => httpClient.get('/api/profesores/me'),
  updateMe: (payload) => httpClient.patch('/api/profesores/me', payload),
};
