// El catálogo de cursos ya no es una lista estática: sale de la base de
// datos vía GET /api/cursos (ver hooks/useCursos.js), para que lo que
// el Administrador da de alta en Académico se refleje en los
// formularios de registro y de alta de usuario sin tocar código.

export const ROLES_ADMIN = [
  { value: 'ESTUDIANTE', label: 'Estudiante' },
  { value: 'DOCENTE', label: 'Docente' },
  { value: 'PADRE', label: 'Padre / Tutor' },
  { value: 'ADMIN', label: 'Administrador' },
];
