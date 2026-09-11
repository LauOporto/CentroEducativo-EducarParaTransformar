import { httpClient } from './httpClient';

export const studentsService = {
  list: () => httpClient.get('/api/students'),
};
