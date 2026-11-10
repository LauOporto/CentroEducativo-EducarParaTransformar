import { DiaSemana } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { formatCursoLabel } from '../utils/cursoLabel';

// Parte 2 — horario de cursado. Cada bloque pertenece a una asignación
// Materia–Curso–Profesor (MateriaCurso). Reglas:
// - un curso no puede tener dos materias en la misma franja;
// - un profesor no puede dictar dos clases a la vez (en cursos distintos);
// - tampoco puede coincidir con un grupo de deporte que ese profesor dirige.

export const DIAS_ORDEN: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

export const DIA_LABEL: Record<DiaSemana, string> = {
  LUNES: 'Lunes',
  MARTES: 'Martes',
  MIERCOLES: 'Miércoles',
  JUEVES: 'Jueves',
  VIERNES: 'Viernes',
  SABADO: 'Sábado',
};

// @db.Time: Prisma exige un Date completo; se usa la misma fecha base que
// GrupoDeporte (ver deportes.routes.ts) para que las horas sean comparables.
export const toTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);
export const hhmm = (d: Date) => d.toISOString().slice(11, 16);

export interface Franja {
  diaSemana: DiaSemana;
  horaInicio: string; // "HH:mm"
  horaFin: string; // "HH:mm"
}

// Rangos semiabiertos: una clase que termina 09:00 no choca con otra que empieza 09:00.
export const seSolapan = (a: Franja, b: Franja) =>
  a.diaSemana === b.diaSemana && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin;

export interface BloqueExistente extends Franja {
  id: number;
  cursoId: number;
  docenteId: number;
  descripcion: string; // "Matemática — Secundaria — 1° año"
}

export interface GrupoDocente extends Franja {
  descripcion: string; // "Fútbol (Secundaria)"
}

// Lógica pura (testeable sin base): devuelve el motivo del conflicto o null.
export function buscarConflicto(
  candidato: Franja & { cursoId: number; docenteId: number; excluirId?: number },
  bloques: BloqueExistente[],
  gruposDocente: GrupoDocente[],
): string | null {
  const franja = `${DIA_LABEL[candidato.diaSemana]} ${candidato.horaInicio}–${candidato.horaFin}`;
  for (const b of bloques) {
    if (b.id === candidato.excluirId || !seSolapan(candidato, b)) continue;
    if (b.cursoId === candidato.cursoId) {
      return `El curso ya tiene ${b.descripcion} el ${DIA_LABEL[b.diaSemana]} de ${b.horaInicio} a ${b.horaFin} (se superpone con ${franja}).`;
    }
    if (b.docenteId === candidato.docenteId) {
      return `El profesor ya dicta ${b.descripcion} el ${DIA_LABEL[b.diaSemana]} de ${b.horaInicio} a ${b.horaFin} (se superpone con ${franja}).`;
    }
  }
  const grupo = gruposDocente.find((g) => seSolapan(candidato, g));
  if (grupo) {
    return `El profesor está a cargo de ${grupo.descripcion} el ${DIA_LABEL[grupo.diaSemana]} de ${grupo.horaInicio} a ${grupo.horaFin}.`;
  }
  return null;
}

const HORARIO_INCLUDE = {
  materiaCurso: {
    include: {
      materia: true,
      curso: { include: { nivel: true } },
      docente: { select: { id: true, nombre: true } },
    },
  },
} as const;

type HorarioConRelaciones = Awaited<ReturnType<typeof listarHorariosRaw>>[number];

function listarHorariosRaw(where: object) {
  return prisma.horarioCurso.findMany({ where, include: HORARIO_INCLUDE });
}

export function aDto(h: HorarioConRelaciones) {
  const mc = h.materiaCurso;
  return {
    id: h.id,
    materiaCursoId: h.materiaCursoId,
    materiaId: mc.materiaId,
    materia: mc.materia.nombre,
    cursoId: mc.cursoId,
    curso: formatCursoLabel(mc.curso)!,
    nivel: mc.curso.nivel.nombre,
    docenteId: mc.docenteId,
    docente: mc.docente.nombre,
    diaSemana: h.diaSemana,
    horaInicio: hhmm(h.horaInicio),
    horaFin: hhmm(h.horaFin),
  };
}

export type HorarioDto = ReturnType<typeof aDto>;

export const ordenarHorarios = (a: HorarioDto, b: HorarioDto) =>
  DIAS_ORDEN.indexOf(a.diaSemana) - DIAS_ORDEN.indexOf(b.diaSemana) || a.horaInicio.localeCompare(b.horaInicio);

export async function listarHorarios(filtro: { cursoId?: number; docenteId?: number }) {
  const rows = await listarHorariosRaw({
    materiaCurso: {
      ...(filtro.cursoId ? { cursoId: filtro.cursoId } : {}),
      ...(filtro.docenteId ? { docenteId: filtro.docenteId } : {}),
    },
  });
  return rows.map(aDto).sort(ordenarHorarios);
}

async function validar(materiaCursoId: number, franja: Franja, excluirId?: number) {
  const mc = await prisma.materiaCurso.findUnique({ where: { id: materiaCursoId } });
  if (!mc) throw HttpError.badRequest('La asignación materia-curso-profesor indicada no existe.');

  const [mismoDia, grupos] = await Promise.all([
    listarHorariosRaw({
      diaSemana: franja.diaSemana,
      materiaCurso: { OR: [{ cursoId: mc.cursoId }, { docenteId: mc.docenteId }] },
    }),
    prisma.grupoDeporte.findMany({
      where: { docenteId: mc.docenteId, diaSemana: franja.diaSemana },
      include: { deporte: true, nivel: true },
    }),
  ]);

  const motivo = buscarConflicto(
    { ...franja, cursoId: mc.cursoId, docenteId: mc.docenteId, excluirId },
    mismoDia.map((h) => {
      const d = aDto(h);
      return { ...d, descripcion: `${d.materia} — ${d.curso}` };
    }),
    grupos.map((g) => ({
      diaSemana: g.diaSemana,
      horaInicio: hhmm(g.horaInicio),
      horaFin: hhmm(g.horaFin),
      descripcion: `${g.deporte.nombre} (${g.nivel.nombre})`,
    })),
  );
  if (motivo) throw HttpError.conflict(motivo);
}

export async function crearHorario(data: Franja & { materiaCursoId: number }) {
  await validar(data.materiaCursoId, data);
  const creado = await prisma.horarioCurso.create({
    data: {
      materiaCursoId: data.materiaCursoId,
      diaSemana: data.diaSemana,
      horaInicio: toTime(data.horaInicio),
      horaFin: toTime(data.horaFin),
    },
    include: HORARIO_INCLUDE,
  });
  return aDto(creado);
}

export async function actualizarHorario(id: number, data: Franja & { materiaCursoId: number }) {
  const actual = await prisma.horarioCurso.findUnique({ where: { id } });
  if (!actual) throw HttpError.notFound('Ese bloque de horario no existe.');
  await validar(data.materiaCursoId, data, id);
  const editado = await prisma.horarioCurso.update({
    where: { id },
    data: {
      materiaCursoId: data.materiaCursoId,
      diaSemana: data.diaSemana,
      horaInicio: toTime(data.horaInicio),
      horaFin: toTime(data.horaFin),
    },
    include: HORARIO_INCLUDE,
  });
  return aDto(editado);
}
