import { CanalNotificacion } from '@prisma/client';

import { NotificacionEmail } from './notificacionEmail';
import { NotificacionInterna } from './notificacionInterna';
import type { Notificacion, NotificacionPayload } from './types';

// El Factory Method en sí: decide qué clase concreta instanciar según
// el canal, sin que el llamador conozca NotificacionEmail ni
// NotificacionInterna. Sumar un canal nuevo (ej. SMS) es agregar un
// case acá + una clase — no hay que tocar quien dispara la alerta.
export function crearNotificacion(canal: CanalNotificacion, payload: NotificacionPayload): Notificacion {
  switch (canal) {
    case CanalNotificacion.EMAIL:
      return new NotificacionEmail(payload);
    case CanalNotificacion.INTERNA:
    default:
      return new NotificacionInterna(payload);
  }
}
