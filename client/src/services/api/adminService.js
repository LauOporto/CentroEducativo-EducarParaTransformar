import { httpClient } from './httpClient';

export const adminService = {
  stats: () => httpClient.get('/api/admin/stats'),

  listUsers: ({ role, q } = {}) => {
    const params = new URLSearchParams();
    if (role) params.set('role', role);
    if (q) params.set('q', q);
    const qs = params.toString();
    return httpClient.get(`/api/admin/users${qs ? `?${qs}` : ''}`);
  },
  createUser: (payload) => httpClient.post('/api/admin/users', payload),
  updateUser: (id, payload) => httpClient.patch(`/api/admin/users/${id}`, payload),
  deactivateUser: (id) => httpClient.delete(`/api/admin/users/${id}`),

  listLinks: () => httpClient.get('/api/admin/links'),
  createLink: (padreId, estudianteId) => httpClient.post('/api/admin/links', { padreId, estudianteId }),
  deleteLink: (id) => httpClient.delete(`/api/admin/links/${id}`),

  pendingTeachers: () => httpClient.get('/api/admin/teachers/pending'),
  approveTeacher: (id) => httpClient.post(`/api/admin/teachers/${id}/approve`),
  rejectTeacher: (id) => httpClient.delete(`/api/admin/teachers/${id}/reject`),
};
