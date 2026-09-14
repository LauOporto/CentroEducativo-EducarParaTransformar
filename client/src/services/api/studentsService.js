import { httpClient } from './httpClient';

export const studentsService = {
  list: () => httpClient.get('/api/students'),
  get: (id) => httpClient.get(`/api/students/${id}`),
  getMaterias: (id) => httpClient.get(`/api/students/${id}/materias`),
  updateMe: (payload) => httpClient.patch('/api/students/me', payload),
};
