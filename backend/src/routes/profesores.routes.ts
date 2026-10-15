import { Router, Request } from 'express';
import { z } from 'zod';
import { Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { requireAuth, requireRole } from '../middleware/auth';
import { crearAsignacion } from '../services/asignaciones.service';
import { estadoProfesorSchema, telefonoSchema } from '../utils/validators';

// Módulo Profesores (RF-12, RF-13, RF-14). Alta/edición/baja de la ficha
// siguen viviendo en /api/admin/users (única fuente de verdad); este router
// es de consulta + asignación de materias (HU4) + autoservicio del docente.
const router = Router();

router.use(requireAuth, requireRole(Role.ADMIN, Role.DOCENTE));

const FICHA_SELECT = {
  id: true,
  usuario: true,
  nombre: true,
  apellido: true,
  legajo: true,
  dni: true,
  especialidad: true,
  email: true,
  telefono: true,
  estadoProfesor: true,
  isActive: true,
} as const;

const hhmm = (d: Date) => d.toISOString().slice(11, 16);

// Admin puede ver a cualquier profesor; un DOCENTE solo a sí mismo (RNF-44/47).
function assertAdminOrSelf(req: Request, docenteId: number) {
  const me = req.authUser!;
  if (me.role === Role.ADMIN) return;
  if (me.id !== docenteId) throw HttpError.forbidden('Solo podés ver tu propia información.');
}

async function assertEsDocente(id: number) {
  const docente = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!docente || docente.role !== Role.DOCENTE) throw HttpError.notFound('Profesor no encontrado.');
}

// RF-13: materias que dicta, con curso y nivel.
async function materiasDe(docenteId: number) {
  const asignaciones = await prisma.materiaCurso.findMany({
    where: { docenteId },
    include: { materia: true, curso: { include: { nivel: true } } },
    orderBy: [{ curso: { nivel: { id: 'asc' } } }, { curso: { nombre: 'asc' } }, { materia: { nombre: 'asc' } }],
  });
  return asignaciones.map((a) => ({
    id: a.id,
    materiaId: a.materiaId,
    materia: a.materia.nombre,
    cursoId: a.cursoId,
    curso: a.curso.nombre,
    nivelId: a.curso.nivelId,
    nivel: a.curso.nivel.nombre,
  }));
}

// RF-14: grupos de deporte donde es el profesor responsable.
async function deportesDe(docenteId: number) {
  const grupos = await prisma.grupoDeporte.findMany({
    where: { docenteId },
    include: { deporte: true, nivel: true, _count: { select: { inscripciones: true } } },
    orderBy: [{ deporte: { nombre: 'asc' } }, { diaSemana: 'asc' }, { horaInicio: 'asc' }],
  });
  return grupos.map((g) => ({
    id: g.id,
    deporteId: g.deporteId,
    deporte: g.deporte.nombre,
    nivelId: g.nivelId,
    nivel: g.nivel.nombre,
    diaSemana: g.diaSemana,
    horaInicio: hhmm(g.horaInicio),
    horaFin: hhmm(g.horaFin),
    alumnosInscriptos: g._count.inscripciones,
  }));
}

// Agrupa las materias por nivel → [{ nivel, materias: [...] }] para la UI.
function agruparPorNivel(materias: Awaited<ReturnType<typeof materiasDe>>) {
  const porNivel = new Map<number, { nivelId: number; nivel: string; materias: typeof materias }>();
  for (const m of materias) {
    if (!porNivel.has(m.nivelId)) porNivel.set(m.nivelId, { nivelId: m.nivelId, nivel: m.nivel, materias: [] });
    porNivel.get(m.nivelId)!.materias.push(m);
  }
  return [...porNivel.values()];
}

async function perfilCompleto(id: number) {
  const profesor = await prisma.user.findUnique({ where: { id }, select: FICHA_SELECT });
  if (!profesor) throw HttpError.notFound('Profesor no encontrado.');
  const [materias, deportes] = await Promise.all([materiasDe(id), deportesDe(id)]);
  return { profesor, materias, materiasPorNivel: agruparPorNivel(materias), deportes };
}

// ---- Autoservicio del docente ----

router.get('/me', requireRole(Role.DOCENTE), async (req, res, next) => {
  try {
    res.json({ exito: true, ...(await perfilCompleto(req.authUser!.id)) });
  } catch (err) { next(err); }
});

// El docente solo edita su contacto; legajo, DNI, especialidad y estado son
// del Admin (ni siquiera están en el schema, Zod los descarta).
const misDatosSchema = z.object({
  email: z.string().email().optional(),
  telefono: telefonoSchema.optional(),
});

router.patch('/me', requireRole(Role.DOCENTE), async (req, res, next) => {
  try {
    const data = misDatosSchema.parse(req.body);
    if (data.email) {
      const conflicto = await prisma.user.findFirst({ where: { email: data.email, NOT: { id: req.authUser!.id } } });
      if (conflicto) throw HttpError.conflict('Ese email ya está en uso.');
    }
    const profesor = await prisma.user.update({ where: { id: req.authUser!.id }, data, select: FICHA_SELECT });
    res.json({ exito: true, profesor });
  } catch (err) { next(err); }
});

// ---- Administración ----

const listSchema = z.object({
  q: z.string().trim().optional(),
  estado: estadoProfesorSchema.optional(),
  nivelId: z.coerce.number().int().positive().optional(),
});

router.get('/', requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const { q, estado, nivelId } = listSchema.parse(req.query);
    const profesores = await prisma.user.findMany({
      where: {
        role: Role.DOCENTE,
        ...(estado ? { estadoProfesor: estado } : {}),
        ...(nivelId ? { materiasDictadas: { some: { curso: { nivelId } } } } : {}),
        ...(q ? {
          OR: [
            { nombre: { contains: q, mode: 'insensitive' } },
            { apellido: { contains: q, mode: 'insensitive' } },
            { legajo: { contains: q, mode: 'insensitive' } },
            { dni: { contains: q } },
            { especialidad: { contains: q, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: [{ apellido: 'asc' }, { nombre: 'asc' }],
      select: { ...FICHA_SELECT, _count: { select: { materiasDictadas: true, gruposDeporteDictados: true } } },
    });
    res.json({
      exito: true,
      profesores: profesores.map(({ _count, ...p }) => ({
        ...p,
        cantidadMaterias: _count.materiasDictadas,
        cantidadGruposDeporte: _count.gruposDeporteDictados,
      })),
    });
  } catch (err) { next(err); }
});

router.get('/:id', requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    await assertEsDocente(id);
    res.json({ exito: true, ...(await perfilCompleto(id)) });
  } catch (err) { next(err); }
});

router.get('/:id/materias', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    assertAdminOrSelf(req, id);
    await assertEsDocente(id);
    const materias = await materiasDe(id);
    res.json({ exito: true, materias, materiasPorNivel: agruparPorNivel(materias) });
  } catch (err) { next(err); }
});

// HU4: asignar materia + curso (y por lo tanto nivel) a un profesor.
const asignarSchema = z.object({
  materiaId: z.coerce.number().int().positive(),
  cursoId: z.coerce.number().int().positive(),
});

router.post('/:id/materias', requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const docenteId = Number(req.params.id);
    const data = asignarSchema.parse(req.body);
    const asignacion = await crearAsignacion({ ...data, docenteId });
    res.json({ exito: true, asignacion });
  } catch (err) { next(err); }
});

router.delete('/:id/materias/:asignacionId', requireRole(Role.ADMIN), async (req, res, next) => {
  try {
    const docenteId = Number(req.params.id);
    const asignacionId = Number(req.params.asignacionId);
    const asignacion = await prisma.materiaCurso.findFirst({ where: { id: asignacionId, docenteId }, select: { id: true } });
    if (!asignacion) throw HttpError.notFound('Esa asignación no existe para este profesor.');
    await prisma.materiaCurso.delete({ where: { id: asignacionId } });
    res.json({ exito: true });
  } catch (err) { next(err); }
});

router.get('/:id/deportes', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    assertAdminOrSelf(req, id);
    await assertEsDocente(id);
    res.json({ exito: true, deportes: await deportesDe(id) });
  } catch (err) { next(err); }
});

export { router as profesoresRouter };
