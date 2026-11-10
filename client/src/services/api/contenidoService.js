import { httpClient } from './httpClient';

// Parte 1: noticias del sitio público y consultas del formulario de contacto.
export const noticiasService = {
  listPublicas: () => httpClient.get('/api/public/noticias'),
  listAdmin: () => httpClient.get('/api/admin/noticias'),
  create: (payload) => httpClient.post('/api/admin/noticias', payload),
  update: (id, payload) => httpClient.patch(`/api/admin/noticias/${id}`, payload),
  remove: (id) => httpClient.delete(`/api/admin/noticias/${id}`),
};

export const consultasService = {
  enviar: (payload) => httpClient.post('/api/public/consultas', payload),
  list: (estado) => httpClient.get(`/api/admin/consultas${estado ? `?estado=${estado}` : ''}`),
  marcar: (id, respondida) => httpClient.patch(`/api/admin/consultas/${id}`, { respondida }),
  remove: (id) => httpClient.delete(`/api/admin/consultas/${id}`),
};
