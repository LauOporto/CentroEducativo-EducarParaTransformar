import { useEffect, useState } from 'react';
import { cursosService } from '../services/api/cursosService';

// Catálogo de cursos (Nivel + Curso) leído de la base, para poblar los
// <select> de registro y de alta/edición de usuario. Reemplaza la lista
// estática que había en domain/cursos.js.
export function useCursos() {
  const [cursos, setCursos] = useState(null);

  useEffect(() => {
    let cancelado = false;
    cursosService.list().then((data) => {
      if (!cancelado) setCursos(data.exito ? data.cursos : []);
    });
    return () => {
      cancelado = true;
    };
  }, []);

  return { cursos: cursos ?? [], loading: cursos === null };
}
