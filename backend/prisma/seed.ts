import {
  PrismaClient,
  Role,
  AttendanceStatus,
  DiaSemana,
} from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// ---- Estructura académica: Niveles y Cursos ----
// Debe coincidir con client/src/domain/cursos.js (catálogo mostrado en
// los formularios de registro y de alta de usuario).
const NIVELES = ['Inicial', 'Primaria', 'Secundaria'] as const;

const CURSOS_POR_NIVEL: Record<(typeof NIVELES)[number], string[]> = {
  Inicial: ['Sala de 3', 'Sala de 4', 'Sala de 5'],
  Primaria: ['1° grado', '2° grado', '3° grado', '4° grado', '5° grado', '6° grado'],
  Secundaria: ['1° año', '2° año', '3° año', '4° año', '5° año'],
};

type UserSeed = {
  usuario: string;
  email: string;
  dni: string;
  nombre: string;
  role: Role;
  curso: string | null; // "<Nivel> — <Curso>", resuelto a cursoId al insertar
  legajo?: string;
  apellido?: string;
  fechaNacimiento?: Date;
  domicilio?: string;
  telefono?: string;
};

const SEED_USERS: UserSeed[] = [
  { usuario: 'admin', email: 'admin@et.edu.ar', dni: '10000001', nombre: 'Administrador del Sistema', role: Role.ADMIN, curso: null },

  { usuario: 'mlopez',    email: 'm.lopez@et.edu.ar',    dni: '20000001', nombre: 'María López',     role: Role.DOCENTE, curso: null },
  { usuario: 'jgarcia',   email: 'j.garcia@et.edu.ar',   dni: '20000002', nombre: 'Javier García',   role: Role.DOCENTE, curso: null },
  { usuario: 'csilva',    email: 'c.silva@et.edu.ar',    dni: '20000003', nombre: 'Carolina Silva',  role: Role.DOCENTE, curso: null },
  { usuario: 'amartinez', email: 'a.martinez@et.edu.ar', dni: '20000004', nombre: 'Andrés Martínez', role: Role.DOCENTE, curso: null },

  { usuario: 'fbarrabino', email: 'f.barrabino@et.edu.ar', dni: '40000001', nombre: 'Franco Barrabino',   role: Role.ESTUDIANTE, curso: 'Secundaria — 1° año', legajo: 'LEG-0001', apellido: 'Barrabino', fechaNacimiento: new Date('2011-03-14'), domicilio: 'Av. Sarmiento 1450, Resistencia', telefono: '3624000001' },
  { usuario: 'jperez',     email: 'j.perez@et.edu.ar',     dni: '40000002', nombre: 'Juan Pérez',         role: Role.ESTUDIANTE, curso: 'Secundaria — 1° año', legajo: 'LEG-0002', apellido: 'Pérez', fechaNacimiento: new Date('2011-06-02'), domicilio: 'Ruta 63 Km 4, Resistencia', telefono: '3624000002' },
  { usuario: 'mgomez',     email: 'm.gomez@et.edu.ar',     dni: '40000003', nombre: 'María Gómez',        role: Role.ESTUDIANTE, curso: 'Primaria — 6° grado', legajo: 'LEG-0003', apellido: 'Gómez', fechaNacimiento: new Date('2014-01-22'), domicilio: 'Calle 9 de Julio 220, Resistencia', telefono: '3624000003' },
  { usuario: 'lferreyra',  email: 'l.ferreyra@et.edu.ar',  dni: '40000004', nombre: 'Lucía Ferreyra',     role: Role.ESTUDIANTE, curso: 'Secundaria — 2° año', legajo: 'LEG-0004', apellido: 'Ferreyra', fechaNacimiento: new Date('2010-09-30'), domicilio: 'Av. 25 de Mayo 880, Resistencia', telefono: '3624000004' },
  { usuario: 'srodriguez', email: 's.rodriguez@et.edu.ar', dni: '40000005', nombre: 'Sofía Rodríguez',    role: Role.ESTUDIANTE, curso: 'Secundaria — 3° año', legajo: 'LEG-0005', apellido: 'Rodríguez', fechaNacimiento: new Date('2009-11-11'), domicilio: 'Calle Pellegrini 340, Resistencia', telefono: '3624000005' },
  { usuario: 'tmoreno',    email: 't.moreno@et.edu.ar',    dni: '40000006', nombre: 'Tomás Moreno',       role: Role.ESTUDIANTE, curso: 'Primaria — 5° grado', legajo: 'LEG-0006', apellido: 'Moreno', fechaNacimiento: new Date('2015-04-18'), domicilio: 'Calle Necochea 512, Resistencia', telefono: '3624000006' },
  { usuario: 'vsanchez',   email: 'v.sanchez@et.edu.ar',   dni: '40000007', nombre: 'Valentina Sánchez',  role: Role.ESTUDIANTE, curso: 'Secundaria — 1° año', legajo: 'LEG-0007', apellido: 'Sánchez', fechaNacimiento: new Date('2011-07-25'), domicilio: 'Av. Alberdi 1290, Resistencia', telefono: '3624000007' },
  { usuario: 'iflores',    email: 'i.flores@et.edu.ar',    dni: '40000008', nombre: 'Ignacio Flores',     role: Role.ESTUDIANTE, curso: 'Primaria — 6° grado', legajo: 'LEG-0008', apellido: 'Flores', fechaNacimiento: new Date('2014-02-09'), domicilio: 'Calle Güemes 78, Resistencia', telefono: '3624000008' },

  { usuario: 'pbarrabino', email: 'p.barrabino@et.edu.ar', dni: '30000001', nombre: 'Patricia Barrabino', role: Role.PADRE, curso: null },
  { usuario: 'rperez',     email: 'r.perez@et.edu.ar',     dni: '30000002', nombre: 'Roberto Pérez',      role: Role.PADRE, curso: null },
  { usuario: 'mgomezp',    email: 'm.gomez.padre@et.edu.ar', dni: '30000003', nombre: 'Mariana Gómez',    role: Role.PADRE, curso: null },
];

// ---- Deportes, grupos de deporte, transporte y comedor ----
const DEPORTES = ['Fútbol', 'Vóley', 'Básquet'] as const;

type GrupoDeporteSeed = {
  deporte: (typeof DEPORTES)[number];
  nivel: (typeof NIVELES)[number];
  diaSemana: DiaSemana;
  horaInicio: string; // "HH:mm"
  horaFin: string; // "HH:mm"
  docente: string; // usuario del docente responsable
};

const GRUPOS_DEPORTE: GrupoDeporteSeed[] = [
  { deporte: 'Fútbol', nivel: 'Primaria', diaSemana: DiaSemana.LUNES, horaInicio: '14:00', horaFin: '15:30', docente: 'amartinez' },
  { deporte: 'Fútbol', nivel: 'Secundaria', diaSemana: DiaSemana.MARTES, horaInicio: '15:00', horaFin: '16:30', docente: 'amartinez' },
  { deporte: 'Vóley', nivel: 'Secundaria', diaSemana: DiaSemana.MIERCOLES, horaInicio: '14:00', horaFin: '15:00', docente: 'csilva' },
  { deporte: 'Básquet', nivel: 'Primaria', diaSemana: DiaSemana.VIERNES, horaInicio: '13:30', horaFin: '14:30', docente: 'jgarcia' },
];

const RECORRIDOS_TRANSPORTE = [
  { nombre: 'Recorrido Norte', horario: 'Salida 07:00 / Regreso 17:30' },
  { nombre: 'Recorrido Sur', horario: 'Salida 07:10 / Regreso 17:40' },
  { nombre: 'Recorrido Este', horario: 'Salida 07:20 / Regreso 17:50' },
  { nombre: 'Recorrido Oeste', horario: 'Salida 07:30 / Regreso 18:00' },
];

const TURNOS_COMEDOR = [
  { nombre: 'Primer turno', horario: '12:00 a 13:00' },
  { nombre: 'Segundo turno', horario: '13:00 a 14:00' },
  { nombre: 'Turno extendido', horario: '14:00 a 15:00' },
];

// GrupoDeporte.horaInicio/horaFin son @db.Time: Postgres solo persiste la
// hora, pero Prisma exige un Date completo de entrada, por eso se fija una
// fecha arbitraria (epoch) igual para todos los registros.
const horaTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

const LINKS = [
  { padre: 'pbarrabino', hijos: ['fbarrabino'] },
  { padre: 'rperez',     hijos: ['jperez'] },
  { padre: 'mgomezp',    hijos: ['mgomez', 'iflores'] },
];

type GradeSeed = {
  estudiante: string;
  docente: string;
  materia: string;
  instancia: string;
  nota: number;
  daysAgo: number;
};

const GRADES: GradeSeed[] = [
  { estudiante: 'fbarrabino', docente: 'mlopez',    materia: 'Álgebra y Geometría', instancia: '1er Trimestre', nota: 8, daysAgo: 60 },
  { estudiante: 'fbarrabino', docente: 'mlopez',    materia: 'Álgebra y Geometría', instancia: '2do Trimestre', nota: 9, daysAgo: 12 },
  { estudiante: 'fbarrabino', docente: 'jgarcia',   materia: 'Literatura',          instancia: '1er Trimestre', nota: 7, daysAgo: 55 },
  { estudiante: 'fbarrabino', docente: 'jgarcia',   materia: 'Literatura',          instancia: '2do Trimestre', nota: 8, daysAgo: 10 },
  { estudiante: 'fbarrabino', docente: 'csilva',    materia: 'Física',              instancia: '1er Trimestre', nota: 6, daysAgo: 40 },
  { estudiante: 'fbarrabino', docente: 'csilva',    materia: 'Química',             instancia: '1er Trimestre', nota: 7, daysAgo: 30 },
  { estudiante: 'fbarrabino', docente: 'amartinez', materia: 'Historia',            instancia: '1er Trimestre', nota: 9, daysAgo: 25 },
  { estudiante: 'fbarrabino', docente: 'amartinez', materia: 'Inglés',              instancia: '1er Trimestre', nota: 10, daysAgo: 20 },

  { estudiante: 'jperez', docente: 'mlopez',    materia: 'Álgebra y Geometría', instancia: '1er Trimestre', nota: 9,  daysAgo: 60 },
  { estudiante: 'jperez', docente: 'mlopez',    materia: 'Álgebra y Geometría', instancia: '2do Trimestre', nota: 10, daysAgo: 8 },
  { estudiante: 'jperez', docente: 'jgarcia',   materia: 'Literatura',          instancia: '1er Trimestre', nota: 7,  daysAgo: 50 },
  { estudiante: 'jperez', docente: 'csilva',    materia: 'Química',             instancia: '1er Trimestre', nota: 8,  daysAgo: 15 },
  { estudiante: 'jperez', docente: 'csilva',    materia: 'Física',              instancia: '1er Trimestre', nota: 7,  daysAgo: 35 },
  { estudiante: 'jperez', docente: 'amartinez', materia: 'Inglés',              instancia: '1er Trimestre', nota: 9,  daysAgo: 22 },

  { estudiante: 'mgomez', docente: 'mlopez',    materia: 'Matemáticas',            instancia: '1er Trimestre', nota: 10, daysAgo: 55 },
  { estudiante: 'mgomez', docente: 'mlopez',    materia: 'Matemáticas',            instancia: '2do Trimestre', nota: 9,  daysAgo: 8 },
  { estudiante: 'mgomez', docente: 'jgarcia',   materia: 'Prácticas del Lenguaje', instancia: '1er Trimestre', nota: 9,  daysAgo: 45 },
  { estudiante: 'mgomez', docente: 'amartinez', materia: 'Ciencias Sociales',      instancia: '1er Trimestre', nota: 8,  daysAgo: 30 },
  { estudiante: 'mgomez', docente: 'csilva',    materia: 'Ciencias Naturales',     instancia: '1er Trimestre', nota: 10, daysAgo: 25 },

  { estudiante: 'lferreyra', docente: 'jgarcia',   materia: 'Literatura',          instancia: '1er Trimestre', nota: 7, daysAgo: 50 },
  { estudiante: 'lferreyra', docente: 'mlopez',    materia: 'Álgebra y Geometría', instancia: '1er Trimestre', nota: 6, daysAgo: 45 },
  { estudiante: 'lferreyra', docente: 'csilva',    materia: 'Biología',            instancia: '1er Trimestre', nota: 8, daysAgo: 28 },
  { estudiante: 'lferreyra', docente: 'amartinez', materia: 'Historia',            instancia: '1er Trimestre', nota: 7, daysAgo: 20 },

  { estudiante: 'srodriguez', docente: 'mlopez',    materia: 'Matemática Discreta', instancia: '1er Trimestre', nota: 9, daysAgo: 50 },
  { estudiante: 'srodriguez', docente: 'csilva',    materia: 'Química Orgánica',    instancia: '1er Trimestre', nota: 8, daysAgo: 35 },
  { estudiante: 'srodriguez', docente: 'amartinez', materia: 'Geografía',           instancia: '1er Trimestre', nota: 10, daysAgo: 20 },

  { estudiante: 'tmoreno', docente: 'mlopez',  materia: 'Matemáticas',            instancia: '1er Trimestre', nota: 7, daysAgo: 50 },
  { estudiante: 'tmoreno', docente: 'jgarcia', materia: 'Prácticas del Lenguaje', instancia: '1er Trimestre', nota: 8, daysAgo: 40 },
  { estudiante: 'tmoreno', docente: 'csilva',  materia: 'Ciencias Naturales',     instancia: '1er Trimestre', nota: 9, daysAgo: 25 },

  { estudiante: 'vsanchez', docente: 'mlopez',    materia: 'Álgebra y Geometría', instancia: '1er Trimestre', nota: 9,  daysAgo: 55 },
  { estudiante: 'vsanchez', docente: 'jgarcia',   materia: 'Literatura',          instancia: '1er Trimestre', nota: 10, daysAgo: 30 },
  { estudiante: 'vsanchez', docente: 'amartinez', materia: 'Inglés',              instancia: '1er Trimestre', nota: 9,  daysAgo: 18 },

  { estudiante: 'iflores', docente: 'mlopez',  materia: 'Matemáticas',            instancia: '1er Trimestre', nota: 8, daysAgo: 48 },
  { estudiante: 'iflores', docente: 'jgarcia', materia: 'Prácticas del Lenguaje', instancia: '1er Trimestre', nota: 7, daysAgo: 38 },
  { estudiante: 'iflores', docente: 'csilva',  materia: 'Ciencias Naturales',     instancia: '1er Trimestre', nota: 9, daysAgo: 22 },
];

async function main() {
  console.log('🌱 Seeding...');

  // ---- Niveles educativos y Cursos ----
  const nivelIdByNombre = new Map<string, number>();
  for (const nombre of NIVELES) {
    const nivel = await prisma.nivelEducativo.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    nivelIdByNombre.set(nombre, nivel.id);
  }

  const cursoIdByLabel = new Map<string, number>();
  for (const nivelNombre of NIVELES) {
    for (const cursoNombre of CURSOS_POR_NIVEL[nivelNombre]) {
      const curso = await prisma.curso.upsert({
        where: { nombre_nivelId: { nombre: cursoNombre, nivelId: nivelIdByNombre.get(nivelNombre)! } },
        update: {},
        create: { nombre: cursoNombre, nivelId: nivelIdByNombre.get(nivelNombre)! },
      });
      cursoIdByLabel.set(`${nivelNombre} — ${cursoNombre}`, curso.id);
    }
  }

  const passwordHash = await bcrypt.hash('123456', 10);
  for (const u of SEED_USERS) {
    const cursoId = u.curso ? cursoIdByLabel.get(u.curso) ?? null : null;
    const ficha = {
      cursoId,
      estado: u.role === Role.ESTUDIANTE ? ('ACTIVO' as const) : null,
      legajo: u.legajo ?? null,
      apellido: u.apellido ?? null,
      fechaNacimiento: u.fechaNacimiento ?? null,
      domicilio: u.domicilio ?? null,
      telefono: u.telefono ?? null,
    };
    await prisma.user.upsert({
      where: { usuario: u.usuario },
      // Actualiza también a usuarios ya existentes (de seeds anteriores)
      // para que reciban los campos nuevos de la ficha académica.
      update: { ...ficha },
      create: {
        usuario: u.usuario,
        email: u.email,
        dni: u.dni,
        nombre: u.nombre,
        role: u.role,
        password: passwordHash,
        ...ficha,
      },
    });
  }

  const byUsername = new Map<string, number>();
  for (const u of await prisma.user.findMany({ select: { id: true, usuario: true } })) {
    byUsername.set(u.usuario, u.id);
  }
  const uid = (u: string) => byUsername.get(u)!;

  // ---- Materias y asignación Profesor–Materia–Curso ----
  // Se derivan de las combinaciones (materia, docente, curso del alumno)
  // que ya aparecen en GRADES, para que RF-11 tenga datos reales.
  const cursoLabelByUsername = new Map(SEED_USERS.map((u) => [u.usuario, u.curso]));
  const materiaIdByNombre = new Map<string, number>();
  const seenAsignaciones = new Set<string>();

  for (const g of GRADES) {
    const cursoLabel = cursoLabelByUsername.get(g.estudiante);
    const cursoId = cursoLabel ? cursoIdByLabel.get(cursoLabel) : undefined;
    if (!cursoId) continue;

    let materiaId = materiaIdByNombre.get(g.materia);
    if (!materiaId) {
      const materia = await prisma.materia.upsert({
        where: { nombre: g.materia },
        update: {},
        create: { nombre: g.materia },
      });
      materiaId = materia.id;
      materiaIdByNombre.set(g.materia, materiaId);
    }

    const key = `${materiaId}-${cursoId}-${uid(g.docente)}`;
    if (seenAsignaciones.has(key)) continue;
    seenAsignaciones.add(key);

    await prisma.materiaCurso.upsert({
      where: { materiaId_cursoId_docenteId: { materiaId, cursoId, docenteId: uid(g.docente) } },
      update: {},
      create: { materiaId, cursoId, docenteId: uid(g.docente) },
    });
  }

  for (const link of LINKS) {
    for (const hijo of link.hijos) {
      await prisma.parentStudentLink.upsert({
        where: { padreId_estudianteId: { padreId: uid(link.padre), estudianteId: uid(hijo) } },
        update: {},
        create: { padreId: uid(link.padre), estudianteId: uid(hijo) },
      });
    }
  }

  const deporteIdByNombre = new Map<string, number>();
  for (const nombre of DEPORTES) {
    const deporte = await prisma.deporte.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
    deporteIdByNombre.set(nombre, deporte.id);
  }

  for (const g of GRUPOS_DEPORTE) {
    const deporteId = deporteIdByNombre.get(g.deporte)!;
    const nivelId = nivelIdByNombre.get(g.nivel)!;
    const horaInicio = horaTime(g.horaInicio);
    const horaFin = horaTime(g.horaFin);
    await prisma.grupoDeporte.upsert({
      where: {
        deporteId_nivelId_diaSemana_horaInicio_horaFin: {
          deporteId,
          nivelId,
          diaSemana: g.diaSemana,
          horaInicio,
          horaFin,
        },
      },
      update: {},
      create: { deporteId, nivelId, diaSemana: g.diaSemana, horaInicio, horaFin, docenteId: uid(g.docente) },
    });
  }

  for (const r of RECORRIDOS_TRANSPORTE) {
    await prisma.recorridoTransporte.upsert({ where: { nombre: r.nombre }, update: {}, create: r });
  }

  for (const t of TURNOS_COMEDOR) {
    await prisma.turnoComedor.upsert({ where: { nombre: t.nombre }, update: {}, create: t });
  }

  const today = new Date();
  const dayIso = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  await prisma.grade.deleteMany({});
  await prisma.grade.createMany({
    data: GRADES.map((g) => ({
      estudianteId: uid(g.estudiante),
      docenteId: uid(g.docente),
      materia: g.materia,
      instancia: g.instancia,
      nota: g.nota,
      fecha: dayIso(g.daysAgo),
    })),
  });

  // ---- Asistencias (últimos 25 días hábiles, por estudiante)
  await prisma.attendance.deleteMany({});
  const estudiantes = SEED_USERS.filter((u) => u.role === Role.ESTUDIANTE);
  const asistenciasData: { estudianteId: number; fecha: Date; status: AttendanceStatus; materia: string; observacion: string | null }[] = [];
  for (let offset = 0; offset < 35; offset++) {
    const d = dayIso(offset);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    for (const est of estudiantes) {
      const seed = (uid(est.usuario) * 31 + d.getDate() + d.getMonth() * 100 + d.getFullYear() * 13) % 22;
      let status: AttendanceStatus = AttendanceStatus.PRESENTE;
      let obs: string | null = null;
      if (seed === 0) { status = AttendanceStatus.AUSENTE; obs = 'Ausencia sin aviso'; }
      else if (seed === 1) { status = AttendanceStatus.TARDE; obs = 'Llegó tras el primer módulo'; }
      else if (seed === 2) { status = AttendanceStatus.JUSTIFICADO; obs = 'Certificado médico'; }
      asistenciasData.push({ estudianteId: uid(est.usuario), fecha: d, status, materia: '', observacion: obs });
    }
  }
  if (asistenciasData.length > 0) {
    await prisma.attendance.createMany({ data: asistenciasData });
  }

  // ---- Notificaciones
  await prisma.notification.deleteMany({});
  await prisma.notification.createMany({
    data: [
      { userId: uid('fbarrabino'), titulo: 'Nueva calificación cargada', contenido: 'María López cargó tu nota de Álgebra (2do Trim).' },
      { userId: uid('jperez'),     titulo: 'Nueva calificación cargada', contenido: 'María López cargó tu nota de Álgebra (2do Trim).' },
      { userId: uid('pbarrabino'), titulo: 'Nueva calificación de tu hijo', contenido: 'Franco tiene una nueva nota cargada en Álgebra.' },
    ],
  });

  // ---- Planes de estudio
  await prisma.studyPlan.deleteMany({});
  await prisma.studyPlan.createMany({
    data: [
      {
        docenteId: uid('mlopez'),
        materia: 'Álgebra y Geometría',
        titulo: 'Plan de Estudios — Álgebra 1er Año',
        objetivos: 'Operar con números reales, plantear y resolver ecuaciones e inecuaciones de primer grado, interpretar gráficamente sistemas de dos ecuaciones.',
        contenidos: 'Unidad 1: Números Reales. Unidad 2: Ecuaciones. Unidad 3: Sistemas. Unidad 4: Geometría plana.',
      },
      {
        docenteId: uid('jgarcia'),
        materia: 'Literatura',
        titulo: 'Plan de Estudios — Literatura 1er Año',
        objetivos: 'Reconocer géneros literarios, analizar textos narrativos y poéticos, producir textos propios con coherencia y cohesión.',
        contenidos: 'Unidad 1: Cuento realista. Unidad 2: Cuento fantástico (Cortázar). Unidad 3: Poesía. Unidad 4: Teatro.',
      },
      {
        docenteId: uid('csilva'),
        materia: 'Física',
        titulo: 'Plan de Estudios — Física 1er Año',
        objetivos: 'Comprender los conceptos básicos de cinemática y dinámica, resolver problemas aplicando fórmulas, interpretar gráficos de movimiento.',
        contenidos: 'Unidad 1: Magnitudes y unidades. Unidad 2: Cinemática (MRU/MRUV). Unidad 3: Dinámica. Unidad 4: Energía.',
      },
    ],
  });

  console.log('✅ Seed completo. Password de todos los usuarios: 123456');
  console.log(
    `   ${SEED_USERS.length} usuarios · ${nivelIdByNombre.size} niveles · ${cursoIdByLabel.size} cursos · ` +
    `${materiaIdByNombre.size} materias · ${seenAsignaciones.size} asignaciones materia-curso-docente · ` +
    `${GRADES.length} notas · ${asistenciasData.length} asistencias · 3 planes de estudio · ` +
    `${deporteIdByNombre.size} deportes · ${GRUPOS_DEPORTE.length} grupos de deporte · ` +
    `${RECORRIDOS_TRANSPORTE.length} recorridos de transporte · ${TURNOS_COMEDOR.length} turnos de comedor`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
