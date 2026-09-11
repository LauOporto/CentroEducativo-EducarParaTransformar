import { httpClient } from './httpClient';

export const notificationsService = {
  list: () => httpClient.get('/api/notifications'),
  markRead: (id) => httpClient.post(`/api/notifications/${id}/read`),
  markAllRead: () => httpClient.post('/api/notifications/read-all'),
};
