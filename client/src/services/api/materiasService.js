import { httpClient } from './httpClient';

export const materiasService = {
  list: () => httpClient.get('/api/materias'),
  create: (payload) => httpClient.post('/api/materias', payload),
  update: (id, payload) => httpClient.patch(`/api/materias/${id}`, payload),
  remove: (id) => httpClient.delete(`/api/materias/${id}`),

  listAsignaciones: () => httpClient.get('/api/materias/asignaciones'),
  createAsignacion: (payload) => httpClient.post('/api/materias/asignaciones', payload),
  removeAsignacion: (id) => httpClient.delete(`/api/materias/asignaciones/${id}`),
};
