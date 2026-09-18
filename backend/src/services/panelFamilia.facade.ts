import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';

const MAX_DEPORTES = 2;

const formatHora = (d: Date) => d.toISOString().slice(11, 16);

function serializeGrupo(g: {
  id: number;
  deporteId: number;
  deporte: { nombre: string };
  nivelId: number;
  nivel: { nombre: string };
  diaSemana: string;
  horaInicio: Date;
  horaFin: Date;
  docenteId: number;
  docente: { id: number; nombre: string };
}) {
  return {
    id: g.id,
    deporteId: g.deporteId,
    deporte: g.deporte.nombre,
    nivelId: g.nivelId,
    nivel: g.nivel.nombre,
    diaSemana: g.diaSemana,
    horaInicio: formatHora(g.horaInicio),
    horaFin: formatHora(g.horaFin),
    docenteId: g.docenteId,
    docente: g.docente.nombre,
  };
}

const GRUPO_INCLUDE = {
  deporte: true,
  nivel: true,
  docente: { select: { id: true, nombre: true } },
} as const;

// Fachada del panel Padre/Alumno (RF-23/RF-24 del Plan de Trabajo): combina
// el catálogo administrable (Deporte/GrupoDeporte/RecorridoTransporte/
// TurnoComedor) con el estado transaccional de inscripción de un alumno
// detrás de una única función por caso de uso, para que el frontend no
// tenga que orquestar 6 pedidos distintos.
export async function obtenerResumenServicios(estudianteId: number) {
  const [inscripcionesDeporte, gruposTodos, transporteActual, recorridosTodos, comedorActual, turnosTodos] =
    await Promise.all([
      prisma.inscripcionDeporte.findMany({
        where: { estudianteId },
        include: { grupoDeporte: { include: GRUPO_INCLUDE } },
      }),
      prisma.grupoDeporte.findMany({ include: GRUPO_INCLUDE, orderBy: [{ deporte: { nombre: 'asc' } }] }),
      prisma.inscripcionTransporte.findMany({ where: { estudianteId }, include: { recorrido: true } }),
      prisma.recorridoTransporte.findMany({ orderBy: { nombre: 'asc' } }),
      prisma.inscripcionComedor.findMany({ where: { estudianteId }, include: { turno: true } }),
      prisma.turnoComedor.findMany({ orderBy: { nombre: 'asc' } }),
    ]);

  const deporteIdsInscriptos = new Set(inscripcionesDeporte.map((i) => i.deporteId));

  return {
    deportes: {
      inscriptos: inscripcionesDeporte.map((i) => serializeGrupo(i.grupoDeporte)),
      disponibles: gruposTodos.filter((g) => !deporteIdsInscriptos.has(g.deporteId)).map(serializeGrupo),
    },
    transporte: {
      actual: transporteActual[0]
        ? { recorridoId: transporteActual[0].recorridoId, recorrido: transporteActual[0].recorrido.nombre }
        : null,
      disponibles: recorridosTodos.map((r) => ({ id: r.id, nombre: r.nombre })),
    },
    comedor: {
      actual: comedorActual[0] ? { turnoId: comedorActual[0].turnoId, turno: comedorActual[0].turno.nombre } : null,
      disponibles: turnosTodos.map((t) => ({ id: t.id, nombre: t.nombre })),
    },
  };
}

export async function inscribirDeporte(estudianteId: number, grupoDeporteId: number) {
  const grupo = await prisma.grupoDeporte.findUnique({ where: { id: grupoDeporteId }, include: GRUPO_INCLUDE });
  if (!grupo) throw HttpError.badRequest('El grupo de deporte indicado no existe.');

  const activas = await prisma.inscripcionDeporte.findMany({
    where: { estudianteId },
    include: { grupoDeporte: { include: GRUPO_INCLUDE } },
  });

  if (activas.some((i) => i.deporteId === grupo.deporteId)) {
    throw HttpError.conflict(`El alumno ya está inscripto en ${grupo.deporte.nombre}.`);
  }

  if (activas.length >= MAX_DEPORTES) {
    throw HttpError.conflict('El alumno ya está inscripto en 2 deportes. Da de baja uno antes de sumar otro.');
  }

  const conflicto = activas.find((i) => {
    const existente = i.grupoDeporte;
    return (
      existente.diaSemana === grupo.diaSemana &&
      grupo.horaInicio < existente.horaFin &&
      existente.horaInicio < grupo.horaFin
    );
  });
  if (conflicto) {
    const e = conflicto.grupoDeporte;
    throw HttpError.conflict(
      `El horario de ${grupo.deporte.nombre} (${formatHora(grupo.horaInicio)} a ${formatHora(grupo.horaFin)}) se superpone con ${e.deporte.nombre}, que ya tiene ese mismo día de ${formatHora(e.horaInicio)} a ${formatHora(e.horaFin)}.`,
    );
  }

  const creada = await prisma.inscripcionDeporte.create({
    data: { estudianteId, deporteId: grupo.deporteId, grupoDeporteId: grupo.id },
    include: { grupoDeporte: { include: GRUPO_INCLUDE } },
  });
  return serializeGrupo(creada.grupoDeporte);
}

export async function desinscribirDeporte(estudianteId: number, grupoDeporteId: number) {
  const inscripcion = await prisma.inscripcionDeporte.findFirst({ where: { estudianteId, grupoDeporteId } });
  if (!inscripcion) throw HttpError.notFound('El alumno no está inscripto en ese grupo de deporte.');
  await prisma.inscripcionDeporte.delete({ where: { id: inscripcion.id } });
}

export async function inscribirTransporte(estudianteId: number, recorridoId: number) {
  const recorrido = await prisma.recorridoTransporte.findUnique({ where: { id: recorridoId } });
  if (!recorrido) throw HttpError.badRequest('El recorrido de transporte indicado no existe.');

  await prisma.inscripcionTransporte.upsert({
    where: { estudianteId },
    update: { recorridoId },
    create: { estudianteId, recorridoId },
  });
  return { recorridoId: recorrido.id, recorrido: recorrido.nombre };
}

export async function desinscribirTransporte(estudianteId: number) {
  const inscripcion = await prisma.inscripcionTransporte.findUnique({ where: { estudianteId } });
  if (!inscripcion) throw HttpError.notFound('El alumno no tiene un recorrido de transporte asignado.');
  await prisma.inscripcionTransporte.delete({ where: { estudianteId } });
}

export async function inscribirComedor(estudianteId: number, turnoId: number) {
  const turno = await prisma.turnoComedor.findUnique({ where: { id: turnoId } });
  if (!turno) throw HttpError.badRequest('El turno de comedor indicado no existe.');

  await prisma.inscripcionComedor.upsert({
    where: { estudianteId },
    update: { turnoId },
    create: { estudianteId, turnoId },
  });
  return { turnoId: turno.id, turno: turno.nombre };
}

export async function desinscribirComedor(estudianteId: number) {
  const inscripcion = await prisma.inscripcionComedor.findUnique({ where: { estudianteId } });
  if (!inscripcion) throw HttpError.notFound('El alumno no tiene un turno de comedor asignado.');
  await prisma.inscripcionComedor.delete({ where: { estudianteId } });
}
