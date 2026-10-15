import { AttendanceStatus } from '@prisma/client';

import { prisma } from '../db/prisma';
import { enviarNotificacion } from './notificaciones/enviarNotificacion';

const UMBRAL_INASISTENCIAS = 3;

// RF-34: "...debe generar automáticamente una notificación al
// padre/tutor asociado cuando el alumno acumule 3 (tres) inasistencias
// no justificadas consecutivas en la misma materia." Se llama después
// de cada alta/actualización de asistencia (attendance.routes.ts).
//
// "Consecutivas" se evalúa sobre la secuencia de registros de
// asistencia de esa materia (no sobre días de calendario, porque no
// todas las materias tienen clase todos los días): se toman los últimos
// 3 y se exige que sean AUSENTE. Para no re-notificar en la 4ta, 5ta...
// inasistencia seguida, además se exige que el registro anterior a esos
// 3 NO sea también AUSENTE (o no exista) — así la alerta se dispara
// una única vez, justo cuando la racha llega a 3.
export async function verificarInasistenciasConsecutivas(estudianteId: number, materia: string): Promise<void> {
  const ultimas = await prisma.attendance.findMany({
    where: { estudianteId, materia },
    orderBy: { fecha: 'desc' },
    take: UMBRAL_INASISTENCIAS + 1,
  });

  if (ultimas.length < UMBRAL_INASISTENCIAS) return;

  const racha = ultimas.slice(0, UMBRAL_INASISTENCIAS);
  if (!racha.every((a) => a.status === AttendanceStatus.AUSENTE)) return;

  const anterior = ultimas[UMBRAL_INASISTENCIAS];
  if (anterior?.status === AttendanceStatus.AUSENTE) return;

  const [estudiante, vinculos] = await Promise.all([
    prisma.user.findUnique({ where: { id: estudianteId }, select: { nombre: true } }),
    prisma.parentStudentLink.findMany({ where: { estudianteId }, select: { padreId: true } }),
  ]);
  if (vinculos.length === 0) return;

  const materiaLabel = materia ? ` en ${materia}` : '';
  const titulo = 'Inasistencias consecutivas';
  const contenido = `${estudiante?.nombre ?? 'El alumno'} acumula ${UMBRAL_INASISTENCIAS} inasistencias no justificadas consecutivas${materiaLabel}.`;

  await Promise.all(
    vinculos.map((v) => enviarNotificacion(v.padreId, titulo, contenido, '/padre/asistencias')),
  );
}
