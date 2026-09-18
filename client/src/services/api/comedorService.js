import { httpClient } from './httpClient';

export const comedorService = {
  list: () => httpClient.get('/api/comedor'),
  create: (payload) => httpClient.post('/api/comedor', payload),
  update: (id, payload) => httpClient.patch(`/api/comedor/${id}`, payload),
  remove: (id) => httpClient.delete(`/api/comedor/${id}`),
};
