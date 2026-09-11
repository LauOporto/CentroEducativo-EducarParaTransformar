import { httpClient } from './httpClient';

export const moderationService = {
  sendInscription: (payload) => httpClient.post('/api/public/inscriptions', payload),
  sendOpinion: (payload) => httpClient.post('/api/public/opinions', payload),
  listApprovedOpinions: () => httpClient.get('/api/public/opinions'),
  sendEmployment: (formData) => httpClient.upload('/api/public/employment', formData),

  listInscriptions: (status) => httpClient.get(`/api/admin/inscriptions${status ? `?status=${status}` : ''}`),
  resolveInscription: (id, action, notaAdmin) => httpClient.post(`/api/admin/inscriptions/${id}/${action}`, { notaAdmin }),
  deleteInscription: (id) => httpClient.delete(`/api/admin/inscriptions/${id}`),

  listOpinions: (status) => httpClient.get(`/api/admin/opinions${status ? `?status=${status}` : ''}`),
  resolveOpinion: (id, action) => httpClient.post(`/api/admin/opinions/${id}/${action}`),
  deleteOpinion: (id) => httpClient.delete(`/api/admin/opinions/${id}`),

  listEmployment: (status) => httpClient.get(`/api/admin/employment${status ? `?status=${status}` : ''}`),
  resolveEmployment: (id, action, notaAdmin) => httpClient.post(`/api/admin/employment/${id}/${action}`, { notaAdmin }),
  deleteEmployment: (id) => httpClient.delete(`/api/admin/employment/${id}`),

  pendingCounts: () => httpClient.get('/api/admin/moderation/counts'),
};
