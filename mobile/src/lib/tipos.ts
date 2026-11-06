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

// RF-54: GET /inscripciones/estudiantes/:id/resumen. Horarios en "HH:mm" y
// precios mensuales como number (0 = el admin todavía no fijó el valor).

export type GrupoDeporte = {
  id: number;
  deporteId: number;
  deporte: string;
  precioMensual: number;
  nivelId: number;
  nivel: string;
  diaSemana: string;
  horaInicio: string;
  horaFin: string;
  docenteId: number;
  docente: string;
};

export type Recorrido = { id: number; nombre: string; horaSalida: string; horaRegreso: string; precioMensual: number };

export type TurnoComedor = { id: number; nombre: string; horaInicio: string; horaFin: string; precioMensual: number };

export type ResumenServicios = {
  exito: true;
  /** nivel: nivel del curso del alumno; null si no tiene curso (no puede anotarse a deportes). */
  deportes: { nivel: string | null; inscriptos: GrupoDeporte[]; disponibles: GrupoDeporte[] };
  transporte: { actual: { recorridoId: number; recorrido: string } | null; disponibles: Recorrido[] };
  comedor: { actual: { turnoId: number; turno: string } | null; disponibles: TurnoComedor[] };
};
