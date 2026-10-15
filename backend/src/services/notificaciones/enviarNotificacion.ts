import { CanalNotificacion } from '@prisma/client';

import { prisma } from '../../db/prisma';
import { crearNotificacion } from './notificacionFactory';

// Punto de entrada único para el resto del backend: busca el canal
// configurado del destinatario y delega en el Factory Method. Quien
// dispara una alerta (ej. asistencia.service.ts) solo llama a esta
// función — nunca a la fábrica ni a las clases concretas directamente.
export async function enviarNotificacion(
  destinatarioId: number,
  titulo: string,
  contenido: string,
  link?: string | null,
): Promise<void> {
  const destinatario = await prisma.user.findUnique({
    where: { id: destinatarioId },
    select: { canalNotificacion: true },
  });
  const canal = destinatario?.canalNotificacion ?? CanalNotificacion.INTERNA;
  const notificacion = crearNotificacion(canal, { destinatarioId, titulo, contenido, link });
  await notificacion.enviar();
}
