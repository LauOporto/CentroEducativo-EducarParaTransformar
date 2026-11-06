import { httpClient } from './httpClient';

export const facturacionService = {
  // HU9: disparo manual de los mails automáticos ('emision' | 'deuda').
  ejecutarJob: (tipo, periodo) => httpClient.post(`/api/admin/facturacion/jobs/${tipo}`, periodo ? { periodo } : {}),
};
