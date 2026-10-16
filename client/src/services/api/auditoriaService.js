import { httpClient } from './httpClient';

export const auditoriaService = {
  list: (entidad) => httpClient.get(`/api/admin/auditoria${entidad ? `?entidad=${entidad}` : ''}`),
};
