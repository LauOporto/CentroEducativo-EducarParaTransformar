// Respuestas de la API que consume la app (contrato en PLAN_PARTE3, sección 4).

export type Hijo = {
  id: number;
  nombre: string;
  dni: string;
  /** Etiqueta del curso, por ejemplo "Secundaria — 1° año", o null si no tiene. */
  curso: string | null;
};

export type RespuestaHijos = { exito: true; hijos: Hijo[] };

export type Perfil = {
  id: number;
  usuario: string;
  email: string;
  dni: string;
  nombre: string;
  role: string;
  curso: string | null;
  tipo: string;
};

export type RespuestaPerfil = { exito: true; usuario: Perfil };

export type RespuestaMensaje = { exito: true; mensaje: string };
