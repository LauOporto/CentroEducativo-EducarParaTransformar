import { httpClient } from './httpClient';

export const attendanceService = {
  listByStudent: (estudianteId, { desde, hasta } = {}) => {
    const params = new URLSearchParams({ estudiante_id: estudianteId });
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);
    return httpClient.get(`/api/attendance?${params.toString()}`);
  },
  byDate: (fecha, materia) => {
    const params = new URLSearchParams({ fecha });
    if (materia) params.set('materia', materia);
    return httpClient.get(`/api/attendance/by-date?${params.toString()}`);
  },
  record: (payload) => httpClient.post('/api/attendance', payload),
  recordBulk: (payload) => httpClient.post('/api/attendance/bulk', payload),
};
