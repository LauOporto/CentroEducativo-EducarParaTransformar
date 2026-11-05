import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { CURSO_SELECT } from './cursoLabel';
import { HttpError } from './httpError';

export const MSG_ROL_SIN_ACCESO_PAGOS = 'Tu rol no tiene acceso a la información de pagos.';
export const MSG_ALUMNO_NO_VINCULADO = 'Ese alumno no está vinculado a tu cuenta.';
export const MSG_ALUMNO_INEXISTENTE = 'El alumno indicado no existe.';

// D7: pagos, facturas y deuda de un alumno los ven solo el ADMIN y el PADRE
// vinculado. A diferencia de assertCanViewStudent, DOCENTE y el propio
// ESTUDIANTE quedan afuera. El rol (y para el PADRE, el vínculo) se chequea
// antes que la existencia del alumno, para no revelar qué ids existen.
// Devuelve el alumno, que el llamador reutiliza sin volver a consultarlo.
export async function assertPuedeVerPagos(req: Pick<Request, 'authUser'>, estudianteId: number) {
  const { role, id } = req.authUser!;
  if (role !== Role.ADMIN && role !== Role.PADRE) throw HttpError.forbidden(MSG_ROL_SIN_ACCESO_PAGOS);

  if (role === Role.PADRE) {
    const link = await prisma.parentStudentLink.findUnique({
      where: { padreId_estudianteId: { padreId: id, estudianteId } },
    });
    if (!link) throw HttpError.forbidden(MSG_ALUMNO_NO_VINCULADO);
  }

  const alumno = await prisma.user.findUnique({
    where: { id: estudianteId },
    select: { id: true, nombre: true, role: true, curso: { select: CURSO_SELECT } },
  });
  if (!alumno || alumno.role !== Role.ESTUDIANTE) throw HttpError.notFound(MSG_ALUMNO_INEXISTENTE);
  return alumno;
}
