import type { DiaSemana, PrismaClient } from '@prisma/client';

import { seSolapan, type Franja } from '../src/services/horarios.service';
import { claveNombre } from '../src/utils/texto';

// Contenido compartido por el seed de desarrollo (seed.ts) y por el script de
// ajustes de producción (ajustes-produccion.ts). Todo es idempotente: se
// puede correr varias veces sin duplicar nada ni pisar lo que cargó el Admin.

// ---- Noticias (Parte 1) ------------------------------------------------------

export const NOTICIAS = [
  {
    fecha: '2026-11-09',
    titulo: 'Nueva app para familias: cuotas y servicios desde el celular',
    resumen:
      'Padres y tutores ya pueden consultar facturas, pagar por transferencia y gestionar deportes, transporte y comedor desde la app.',
    contenido:
      'Presentamos la aplicación móvil de Educar para Transformar para padres y tutores. Con el mismo usuario del campus web se puede ver el estado de cuenta de cada hijo, descargar las facturas, elegir qué ítems pagar, generar el comprobante de pago y cargar la transferencia bancaria. También permite inscribir a los chicos a deportes, transporte y comedor. Los pagos se realizan únicamente por transferencia: no se aceptan pagos en efectivo.',
  },
  {
    fecha: '2026-11-03',
    titulo: 'Abrimos la inscripción para el ciclo lectivo 2027',
    resumen:
      'Ya podés solicitar la vacante para Inicial, Primario y Secundario desde el formulario de inscripción del sitio.',
    contenido:
      'Comenzó el período de inscripción para el primer ciclo lectivo del colegio, que inicia en marzo de 2027. Las familias interesadas pueden completar la solicitud de inscripción en este sitio; el equipo de admisión se comunicará para coordinar una entrevista y la entrega de la documentación. Las vacantes son limitadas en cada curso.',
  },
  {
    fecha: '2026-10-27',
    titulo: 'Jornada de puertas abiertas el sábado 21 de noviembre',
    resumen: 'Recorré el campus, conocé a los equipos docentes y resolvé tus dudas sobre la jornada extendida.',
    contenido:
      'El sábado 21 de noviembre, de 9 a 13 horas, abrimos las puertas del colegio para que las familias recorran las aulas, los laboratorios de computación, física y química, el gimnasio cubierto y la pileta. Habrá charlas sobre la propuesta de idiomas, los deportes y los servicios de comedor y transporte. No hace falta inscribirse.',
  },
  {
    fecha: '2026-10-14',
    titulo: 'Avanza la obra del natatorio y del gimnasio cubierto',
    resumen:
      'La pileta climatizada y el gimnasio estarán listos para el inicio de clases, junto con las canchas y la pista de atletismo.',
    contenido:
      'La obra del campus entró en su etapa final. El natatorio climatizado, el gimnasio cubierto, las canchas de fútbol y la pista de atletismo estarán habilitados para el comienzo del ciclo lectivo 2027. Allí se dictarán los ocho deportes de la propuesta: atletismo, natación, fútbol, artes marciales, vóleibol, danza, básquet y ajedrez.',
  },
  {
    fecha: '2026-09-30',
    titulo: 'Idiomas desde Sala de 3: inglés, portugués y francés',
    resumen:
      'Presentamos la propuesta de idiomas, con continuidad en los tres niveles y dentro de la jornada extendida.',
    contenido:
      'La propuesta lingüística del colegio incluye inglés desde Sala de 3 y suma portugués y francés en Primario y Secundario. Las clases se dictan en grupos reducidos dentro de la jornada extendida, con certificaciones internacionales opcionales en los últimos años del Secundario.',
  },
  {
    fecha: '2026-09-15',
    titulo: 'Convocatoria docente 2027',
    resumen: 'Buscamos docentes y personal para todos los niveles. Podés postularte desde la sección Empleo.',
    contenido:
      'Estamos conformando los equipos de trabajo para el ciclo 2027. Buscamos docentes de nivel Inicial, Primario y Secundario, profesores de idiomas y de educación física, personal de enfermería y personal administrativo. Para postularte, completá el formulario de la sección Empleo y adjuntá tu CV en PDF.',
  },
  {
    fecha: '2026-09-02',
    titulo: 'Cuatro recorridos de micro para llegar al colegio',
    resumen: 'El servicio de transporte tendrá los recorridos Norte, Sur, Este y Oeste, con salida y regreso diarios.',
    contenido:
      'El servicio de micros de traslado contará con cuatro recorridos que cubren los distintos barrios de Resistencia. Es opcional y se puede contratar o cambiar de recorrido mes a mes desde el campus o la app para familias. Cada recorrido tiene su propio valor mensual.',
  },
];

export async function sembrarNoticias(prisma: PrismaClient): Promise<number> {
  let creadas = 0;
  for (const n of NOTICIAS) {
    if (await prisma.noticia.findFirst({ where: { titulo: n.titulo } })) continue;
    await prisma.noticia.create({ data: { ...n, fecha: new Date(`${n.fecha}T00:00:00.000Z`), publicada: true } });
    creadas += 1;
  }
  return creadas;
}

// ---- Catálogo de deportes y servicios (Parte 2) -------------------------------

// Los ocho deportes que pide el enunciado. Las versiones anteriores del seed
// usaban otros nombres; se renombran (conservan grupos e inscripciones).
export const DEPORTES_TP = [
  'Atletismo',
  'Natación',
  'Fútbol',
  'Artes Marciales',
  'Vóleibol',
  'Danza',
  'Básquet',
  'Ajedrez',
];
const RENOMBRES_DEPORTE: Record<string, string> = { Vóley: 'Vóleibol', Handball: 'Artes Marciales', Hockey: 'Danza' };

// Deportes cargados dos veces con distinta tilde o mayúscula ("Futbol" y
// "Fútbol"): se conserva el del enunciado (o el que tiene más grupos) y se le
// pasan los grupos y las inscripciones del duplicado. Si mover algo chocara
// con un registro existente, no se toca y se avisa para revisarlo a mano.
async function unificarDeportesDuplicados(prisma: PrismaClient, log: string[]) {
  const preferidos = new Set([...DEPORTES_TP, ...Object.keys(RENOMBRES_DEPORTE)]);
  const deportes = await prisma.deporte.findMany({
    orderBy: { id: 'asc' },
    include: { grupos: true, inscripciones: true },
  });
  const porClave = new Map<string, typeof deportes>();
  for (const d of deportes) porClave.set(claveNombre(d.nombre), [...(porClave.get(claveNombre(d.nombre)) ?? []), d]);

  for (const grupo of porClave.values()) {
    if (grupo.length < 2) continue;
    const [conservado, ...duplicados] = [...grupo].sort(
      (a, b) =>
        Number(preferidos.has(b.nombre)) - Number(preferidos.has(a.nombre)) ||
        b.grupos.length - a.grupos.length ||
        a.id - b.id,
    );
    for (const dup of duplicados) {
      const choqueGrupo = dup.grupos.find((g) =>
        conservado.grupos.some(
          (c) =>
            c.nivelId === g.nivelId &&
            c.diaSemana === g.diaSemana &&
            hhmm(c.horaInicio) === hhmm(g.horaInicio) &&
            hhmm(c.horaFin) === hhmm(g.horaFin),
        ),
      );
      const choqueAlumno = dup.inscripciones.find((i) =>
        conservado.inscripciones.some((c) => c.estudianteId === i.estudianteId),
      );
      if (choqueGrupo || choqueAlumno) {
        log.push(
          `⚠ No se unificó "${dup.nombre}" con "${conservado.nombre}": hay grupos o alumnos repetidos. Revisalo a mano.`,
        );
        continue;
      }
      await prisma.$transaction([
        prisma.grupoDeporte.updateMany({ where: { deporteId: dup.id }, data: { deporteId: conservado.id } }),
        prisma.inscripcionDeporte.updateMany({ where: { deporteId: dup.id }, data: { deporteId: conservado.id } }),
        prisma.deporte.delete({ where: { id: dup.id } }),
      ]);
      conservado.grupos.push(...dup.grupos);
      conservado.inscripciones.push(...dup.inscripciones);
      log.push(
        `Deporte duplicado "${dup.nombre}" unificado con "${conservado.nombre}" (${dup.grupos.length} grupos, ${dup.inscripciones.length} inscripciones)`,
      );
    }
  }
}

export async function ajustarCatalogo(prisma: PrismaClient): Promise<string[]> {
  const log: string[] = [];

  await unificarDeportesDuplicados(prisma, log);

  for (const [viejo, nuevo] of Object.entries(RENOMBRES_DEPORTE)) {
    const [origen, destino] = await Promise.all([
      prisma.deporte.findUnique({ where: { nombre: viejo } }),
      prisma.deporte.findUnique({ where: { nombre: nuevo } }),
    ]);
    if (!origen) continue;
    if (destino) {
      log.push(`⚠ No se renombró "${viejo}": ya existe "${nuevo}". Revisalo a mano.`);
      continue;
    }
    await prisma.deporte.update({ where: { id: origen.id }, data: { nombre: nuevo } });
    log.push(`Deporte "${viejo}" → "${nuevo}"`);
  }
  for (const nombre of DEPORTES_TP) {
    if (await prisma.deporte.findUnique({ where: { nombre } })) continue;
    await prisma.deporte.create({ data: { nombre } });
    log.push(`Deporte creado: "${nombre}" (falta crearle grupos desde el panel)`);
  }

  // Turnos de comedor duplicados por mayúsculas, tildes o espacios ("Primer Turno" y
  // "Primer turno"): se conserva el más antiguo y se le pasan las inscripciones.
  const turnos = await prisma.turnoComedor.findMany({ orderBy: { id: 'asc' } });
  const porNombre = new Map<string, typeof turnos>();
  for (const t of turnos) porNombre.set(claveNombre(t.nombre), [...(porNombre.get(claveNombre(t.nombre)) ?? []), t]);
  for (const grupo of porNombre.values()) {
    const [conservado, ...duplicados] = grupo;
    for (const dup of duplicados) {
      await prisma.$transaction([
        prisma.inscripcionComedor.updateMany({ where: { turnoId: dup.id }, data: { turnoId: conservado.id } }),
        prisma.turnoComedor.delete({ where: { id: dup.id } }),
      ]);
      log.push(`Turno de comedor duplicado "${dup.nombre}" unificado con "${conservado.nombre}"`);
    }
  }

  const recorridos = await prisma.recorridoTransporte.count();
  if (recorridos > 4)
    log.push(`⚠ Hay ${recorridos} recorridos de transporte: el enunciado pide 4. Revisalo desde el panel.`);

  return log;
}

// ---- Horario de cursado (Parte 2) ---------------------------------------------

const DIAS_HABILES: DiaSemana[] = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES'];

// Turno mañana de la jornada extendida (la tarde queda para deportes,
// idiomas y apoyo). Inicial tiene bloques más cortos.
const FRANJAS: Record<string, [string, string][]> = {
  Inicial: [
    ['08:00', '09:00'],
    ['09:15', '10:15'],
    ['10:30', '11:30'],
  ],
  default: [
    ['07:40', '09:00'],
    ['09:10', '10:30'],
    ['10:50', '12:10'],
    ['12:20', '13:30'],
  ],
};
const BLOQUES_POR_MATERIA = 2;

const hhmm = (d: Date) => d.toISOString().slice(11, 16);
const hora = (s: string) => new Date(`1970-01-01T${s}:00.000Z`);

// Genera el horario de los cursos que todavía no tienen ninguno, respetando
// las mismas reglas que valida la API: sin superposición dentro del curso,
// sin profesores en dos lugares a la vez y sin chocar con sus grupos de deporte.
export async function generarHorarios(prisma: PrismaClient): Promise<{ cursos: number; bloques: number }> {
  const [cursos, existentes, grupos] = await Promise.all([
    prisma.curso.findMany({
      include: { nivel: true, materiaCursos: { include: { materia: true }, orderBy: { materia: { nombre: 'asc' } } } },
      orderBy: [{ nivelId: 'asc' }, { nombre: 'asc' }],
    }),
    prisma.horarioCurso.findMany({ include: { materiaCurso: true } }),
    prisma.grupoDeporte.findMany(),
  ]);

  type Ocupado = Franja & { docenteId: number; cursoId: number };
  const ocupados: Ocupado[] = existentes.map((h) => ({
    diaSemana: h.diaSemana,
    horaInicio: hhmm(h.horaInicio),
    horaFin: hhmm(h.horaFin),
    docenteId: h.materiaCurso.docenteId,
    cursoId: h.materiaCurso.cursoId,
  }));
  const deportes = grupos.map((g) => ({
    diaSemana: g.diaSemana,
    horaInicio: hhmm(g.horaInicio),
    horaFin: hhmm(g.horaFin),
    docenteId: g.docenteId,
  }));
  const cursosConHorario = new Set(ocupados.map((o) => o.cursoId));

  const pendientes = cursos.filter((c) => !cursosConHorario.has(c.id) && c.materiaCursos.length > 0);
  const diasPorMateria = new Map<number, Set<DiaSemana>>();
  const nuevos: { cursoId: number; materiaCursoId: number; franja: Franja }[] = [];

  // Vueltas globales: primero un bloque para cada materia de todos los cursos
  // y recién después el segundo. Así ningún curso se queda sin una materia
  // porque los anteriores agotaron la agenda de un profesor compartido.
  for (let vuelta = 0; vuelta < BLOQUES_POR_MATERIA; vuelta++) {
    for (const curso of pendientes) {
      const franjas = FRANJAS[curso.nivel.nombre] ?? FRANJAS.default;
      curso.materiaCursos.forEach((mc, i) => {
        const usados = diasPorMateria.get(mc.id) ?? new Set<DiaSemana>();
        for (let k = 0; k < DIAS_HABILES.length * franjas.length; k++) {
          // Arranca en un día distinto por materia y por vuelta para repartir la semana.
          const dia = DIAS_HABILES[(i + vuelta * 2 + Math.floor(k / franjas.length)) % DIAS_HABILES.length];
          const [desde, hasta] = franjas[k % franjas.length];
          const franja: Franja = { diaSemana: dia, horaInicio: desde, horaFin: hasta };
          if (usados.has(dia)) continue;
          const choca =
            ocupados.some((o) => (o.cursoId === curso.id || o.docenteId === mc.docenteId) && seSolapan(o, franja)) ||
            deportes.some((g) => g.docenteId === mc.docenteId && seSolapan(g, franja));
          if (choca) continue;
          ocupados.push({ ...franja, docenteId: mc.docenteId, cursoId: curso.id });
          usados.add(dia);
          diasPorMateria.set(mc.id, usados);
          nuevos.push({ cursoId: curso.id, materiaCursoId: mc.id, franja });
          break;
        }
      });
    }
  }

  if (nuevos.length > 0) {
    await prisma.horarioCurso.createMany({
      data: nuevos.map((n) => ({
        materiaCursoId: n.materiaCursoId,
        diaSemana: n.franja.diaSemana,
        horaInicio: hora(n.franja.horaInicio),
        horaFin: hora(n.franja.horaFin),
      })),
      skipDuplicates: true,
    });
  }
  return { cursos: new Set(nuevos.map((n) => n.cursoId)).size, bloques: nuevos.length };
}
