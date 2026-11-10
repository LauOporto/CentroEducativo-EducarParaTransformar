import { httpClient } from './httpClient';

// Parte 2: horario de cursado (Materia–Curso–Profesor en un día y una franja).
export const horariosService = {
  list: (filtros = {}) => {
    const qs = new URLSearchParams(Object.entries(filtros).filter(([, v]) => v !== undefined && v !== '')).toString();
    return httpClient.get(`/api/horarios${qs ? `?${qs}` : ''}`);
  },
  create: (payload) => httpClient.post('/api/horarios', payload),
  update: (id, payload) => httpClient.patch(`/api/horarios/${id}`, payload),
  remove: (id) => httpClient.delete(`/api/horarios/${id}`),
};

export const DIAS = [
  { key: 'LUNES', label: 'Lunes' },
  { key: 'MARTES', label: 'Martes' },
  { key: 'MIERCOLES', label: 'Miércoles' },
  { key: 'JUEVES', label: 'Jueves' },
  { key: 'VIERNES', label: 'Viernes' },
  { key: 'SABADO', label: 'Sábado' },
];

export const diaLabel = (key) => DIAS.find((d) => d.key === key)?.label ?? key;
