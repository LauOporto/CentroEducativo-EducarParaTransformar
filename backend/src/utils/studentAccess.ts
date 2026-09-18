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

// Gestionar (inscribir/desinscribir) servicios de un alumno es más
// restrictivo que solo verlos: el propio alumno y el docente no pueden
// autogestionarse ni gestionar a otros, solo Admin o el padre/tutor
// vinculado (RF-18 a RF-22, gestionadas "por el padre" según el TP).
export async function assertCanManageStudentServices(req: Request, studentId: number) {
  const { role, id } = req.authUser!;
  if (role === Role.ADMIN) return;
  if (role === Role.PADRE) {
    const link = await prisma.parentStudentLink.findUnique({
      where: { padreId_estudianteId: { padreId: id, estudianteId: studentId } },
    });
    if (!link) throw HttpError.forbidden('Ese alumno no está vinculado a tu cuenta.');
    return;
  }
  throw HttpError.forbidden();
}
