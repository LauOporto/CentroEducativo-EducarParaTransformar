import type { Request } from 'express';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from './httpError';

// Un alumno puede ver su propia ficha; un padre solo la de sus hijos
// vinculados; docente/admin sin restricción (RNF-44/RNF-47).
export async function assertCanViewStudent(req: Request, studentId: number) {
  const { role, id } = req.authUser!;
  if (role === Role.ADMIN || role === Role.DOCENTE) return;
  if (role === Role.ESTUDIANTE) {
    if (id !== studentId) throw HttpError.forbidden('Solo podés consultar tu propia ficha.');
    return;
  }
  if (role === Role.PADRE) {
    const link = await prisma.parentStudentLink.findUnique({
      where: { padreId_estudianteId: { padreId: id, estudianteId: studentId } },
    });
    if (!link) throw HttpError.forbidden('Ese alumno no está vinculado a tu cuenta.');
    return;
  }
  throw HttpError.forbidden();
}

// Gestionar (inscribir/desinscribir) servicios de un alumno: el propio
// alumno puede autogestionarse (el TP lo dice explícitamente en
// Reglas de Negocio: "Cada alumno puede: inscribirse a dos deportes...
// / al servicio de transporte... / al servicio de comedor" — la
// potestad del padre, en cambio, es otra regla distinta y separada,
// "inscribir a su hijo al CURSADO", que no cubre estos tres servicios).
// Docente queda afuera porque el TP no le da ningún rol en esto.
export async function assertCanManageStudentServices(req: Request, studentId: number) {
  const { role, id } = req.authUser!;
  if (role === Role.ADMIN) return;
  if (role === Role.ESTUDIANTE) {
    if (id !== studentId) throw HttpError.forbidden('Solo podés gestionar tus propios servicios.');
    return;
  }
  if (role === Role.PADRE) {
    const link = await prisma.parentStudentLink.findUnique({
      where: { padreId_estudianteId: { padreId: id, estudianteId: studentId } },
    });
    if (!link) throw HttpError.forbidden('Ese alumno no está vinculado a tu cuenta.');
    return;
  }
  throw HttpError.forbidden();
}
