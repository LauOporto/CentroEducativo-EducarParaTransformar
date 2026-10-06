// Factory Method de notificaciones (RF-34 y, en general, cualquier
// alerta automática del sistema): una interfaz común "Notificacion" con
// un método enviar(), y clases concretas por canal. El código que
// dispara una alerta (ver asistencia.service.ts) solo conoce esta
// interfaz — nunca instancia NotificacionEmail o NotificacionInterna
// directamente, eso lo decide notificacionFactory.ts según el canal
// configurado del destinatario.

export interface NotificacionPayload {
  destinatarioId: number;
  titulo: string;
  contenido: string;
  link?: string | null;
}

export interface Notificacion {
  enviar(): Promise<void>;
}
