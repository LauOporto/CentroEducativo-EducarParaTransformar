import { httpClient } from './httpClient';

export const gradesService = {
  listByStudent: (estudianteId) => httpClient.get(`/api/grades?estudiante_id=${estudianteId}`),
  listMine: () => httpClient.get('/api/grades/mine'),
  create: (payload) => httpClient.post('/api/grades', payload),
};
