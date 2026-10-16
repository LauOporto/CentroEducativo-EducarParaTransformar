import { httpClient } from './httpClient';

export const galeriaService = {
  list: () => httpClient.get('/api/public/galeria'),
  create: (formData) => httpClient.upload('/api/admin/galeria', formData),
  remove: (id) => httpClient.delete(`/api/admin/galeria/${id}`),
};
