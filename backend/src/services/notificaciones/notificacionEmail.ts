import { prisma } from '../../db/prisma';
import { logger } from '../../utils/logger';
import { enviarMail, htmlMail } from '../mail.service';
import type { Notificacion, NotificacionPayload } from './types';

// Canal EMAIL: manda la notificación por mail con services/mail.service.ts
// (D11). El proveedor es un detalle interno de ese servicio: ni esta clase
// ni quien dispara la alerta saben cuál es. Esa es la ventaja concreta del
// Factory Method sobre construir la notificación a mano en el llamador.
export class NotificacionEmail implements Notificacion {
  constructor(private payload: NotificacionPayload) {}

  async enviar(): Promise<void> {
    const destinatario = await prisma.user.findUnique({
      where: { id: this.payload.destinatarioId },
      select: { email: true, nombre: true },
    });
    if (!destinatario) {
      logger.warn('Notificación por email sin destinatario', { destinatarioId: this.payload.destinatarioId });
      return;
    }

    const saludo = `Hola, ${destinatario.nombre}:`;
    const resultado = await enviarMail({
      para: destinatario.email,
      asunto: this.payload.titulo,
      texto: `${saludo}\n\n${this.payload.contenido}`,
      html: htmlMail({ saludo, parrafos: [this.payload.contenido] }),
    });
    logger.info('Notificación por email', {
      destinatarioId: this.payload.destinatarioId,
      titulo: this.payload.titulo,
      transporte: resultado.transporte,
    });
  }
}
