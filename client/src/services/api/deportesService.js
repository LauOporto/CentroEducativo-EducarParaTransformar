import { httpClient } from './httpClient';

export const deportesService = {
  list: () => httpClient.get('/api/deportes'),
  create: (payload) => httpClient.post('/api/deportes', payload),
  update: (id, payload) => httpClient.patch(`/api/deportes/${id}`, payload),
  remove: (id) => httpClient.delete(`/api/deportes/${id}`),

  listGrupos: () => httpClient.get('/api/deportes/grupos'),
  createGrupo: (payload) => httpClient.post('/api/deportes/grupos', payload),
  removeGrupo: (id) => httpClient.delete(`/api/deportes/grupos/${id}`),
};
