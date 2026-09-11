import { httpClient } from './httpClient';

export const studyPlansService = {
  list: (materia) => httpClient.get(materia ? `/api/study-plans?materia=${encodeURIComponent(materia)}` : '/api/study-plans'),
  create: (formData) => httpClient.upload('/api/study-plans', formData),
};
