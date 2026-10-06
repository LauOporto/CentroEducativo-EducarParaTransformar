import { prisma } from '../../db/prisma';
import { logger } from '../../utils/logger';
import type { Notificacion, NotificacionPayload } from './types';

// Canal INTERNA: la notificación queda como una fila en la campanita
// (modelo Notification, ya consumida por notifications.routes.ts).
export class NotificacionInterna implements Notificacion {
  constructor(private payload: NotificacionPayload) {}

  async enviar(): Promise<void> {
    await prisma.notification.create({
      data: {
        userId: this.payload.destinatarioId,
        titulo: this.payload.titulo,
        contenido: this.payload.contenido,
        link: this.payload.link ?? null,
      },
    });
    logger.info('Notificación interna creada', {
      userId: this.payload.destinatarioId,
      titulo: this.payload.titulo,
    });
  }
}
