import { httpClient } from './httpClient';

export const nivelesService = {
  list: () => httpClient.get('/api/niveles'),
  create: (payload) => httpClient.post('/api/niveles', payload),
  update: (id, payload) => httpClient.patch(`/api/niveles/${id}`, payload),
  remove: (id) => httpClient.delete(`/api/niveles/${id}`),
};
