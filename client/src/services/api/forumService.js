import { httpClient } from './httpClient';

export const forumService = {
  list: (materia) => httpClient.get(materia ? `/api/forum?materia=${encodeURIComponent(materia)}` : '/api/forum'),
  get: (id) => httpClient.get(`/api/forum/${id}`),
  create: (payload) => httpClient.post('/api/forum', payload),
  reply: (id, contenido) => httpClient.post(`/api/forum/${id}/reply`, { contenido }),
  remove: (id) => httpClient.delete(`/api/forum/${id}`),
  togglePin: (id) => httpClient.post(`/api/forum/${id}/pin`),
};
