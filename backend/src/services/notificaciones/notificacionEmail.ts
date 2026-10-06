import { prisma } from '../../db/prisma';
import { logger } from '../../utils/logger';
import type { Notificacion, NotificacionPayload } from './types';

// Canal EMAIL: este backend no tiene un proveedor SMTP configurado (sin
// nodemailer ni credenciales) — enviar() deja registrado el intento con
// el contenido completo por logger, tal como quedaría trazado un envío
// real. Conectar un proveedor real (nodemailer, SES, etc.) es un cambio
// interno de ESTA clase; nada fuera de services/notificaciones/ conoce
// el detalle de cómo se manda un email — esa es la ventaja concreta del
// Factory Method sobre construir la notificación a mano en el llamador.
export class NotificacionEmail implements Notificacion {
  constructor(private payload: NotificacionPayload) {}

  async enviar(): Promise<void> {
    const destinatario = await prisma.user.findUnique({
      where: { id: this.payload.destinatarioId },
      select: { email: true, nombre: true },
    });
    logger.info('Notificación por email (sin proveedor SMTP configurado — solo se deja trazada)', {
      to: destinatario?.email ?? null,
      nombre: destinatario?.nombre ?? null,
      titulo: this.payload.titulo,
      contenido: this.payload.contenido,
    });
  }
}
