import { httpClient } from './httpClient';

export const transporteService = {
  list: () => httpClient.get('/api/transporte'),
  create: (payload) => httpClient.post('/api/transporte', payload),
  update: (id, payload) => httpClient.patch(`/api/transporte/${id}`, payload),
  remove: (id) => httpClient.delete(`/api/transporte/${id}`),
};
