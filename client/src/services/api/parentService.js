import { httpClient } from './httpClient';

export const parentService = {
  listHijos: () => httpClient.get('/api/parent/hijos'),
  vincularHijo: (dni) => httpClient.post('/api/parent/vincular', { dni }),
};
