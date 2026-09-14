import { httpClient } from './httpClient';

export const cursosService = {
  list: () => httpClient.get('/api/cursos'),
  create: (payload) => httpClient.post('/api/cursos', payload),
  update: (id, payload) => httpClient.patch(`/api/cursos/${id}`, payload),
  remove: (id) => httpClient.delete(`/api/cursos/${id}`),
};
