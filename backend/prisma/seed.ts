import {
  PrismaClient,
  Role,
  AttendanceStatus,
  DiaSemana,
  CanalNotificacion,
  ModerationStatus,
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
  canalNotificacion?: CanalNotificacion; // RF-34 — Factory Method de notificaciones
  especialidad?: string;
};

const SEED_USERS: UserSeed[] = [
  { usuario: 'admin', email: 'admin@et.edu.ar', dni: '10000001', nombre: 'Administrador del Sistema', role: Role.ADMIN, curso: null },

  { usuario: 'mlopez',    email: 'm.lopez@et.edu.ar',    dni: '20000001', nombre: 'María López',     role: Role.DOCENTE, curso: null, legajo: 'DOC-0001', apellido: 'López',    telefono: '3624100001', especialidad: 'Matemática' },
  { usuario: 'jgarcia',   email: 'j.garcia@et.edu.ar',   dni: '20000002', nombre: 'Javier García',   role: Role.DOCENTE, curso: null, legajo: 'DOC-0002', apellido: 'García',   telefono: '3624100002', especialidad: 'Lengua y Literatura' },
  { usuario: 'csilva',    email: 'c.silva@et.edu.ar',    dni: '20000003', nombre: 'Carolina Silva',  role: Role.DOCENTE, curso: null, legajo: 'DOC-0003', apellido: 'Silva',    telefono: '3624100003', especialidad: 'Ciencias Naturales' },
  { usuario: 'amartinez', email: 'a.martinez@et.edu.ar', dni: '20000004', nombre: 'Andrés Martínez', role: Role.DOCENTE, curso: null, legajo: 'DOC-0004', apellido: 'Martínez', telefono: '3624100004', especialidad: 'Ciencias Sociales y Educación Física' },
  { usuario: 'rfernandez', email: 'r.fernandez@et.edu.ar', dni: '20000005', nombre: 'Romina Fernández', role: Role.DOCENTE, curso: null, legajo: 'DOC-0005', apellido: 'Fernández', telefono: '3624100005', especialidad: 'Inglés' },
  { usuario: 'gacosta',    email: 'g.acosta@et.edu.ar',    dni: '20000006', nombre: 'Gustavo Acosta',   role: Role.DOCENTE, curso: null, legajo: 'DOC-0006', apellido: 'Acosta',    telefono: '3624100006', especialidad: 'Educación Física' },
  { usuario: 'vromero',    email: 'v.romero@et.edu.ar',    dni: '20000007', nombre: 'Verónica Romero',  role: Role.DOCENTE, curso: null, legajo: 'DOC-0007', apellido: 'Romero',    telefono: '3624100007', especialidad: 'Música y Artes Visuales' },
  { usuario: 'dbenitez',   email: 'd.benitez@et.edu.ar',   dni: '20000008', nombre: 'Diego Benítez',    role: Role.DOCENTE, curso: null, legajo: 'DOC-0008', apellido: 'Benítez',   telefono: '3624100008', especialidad: 'Informática y Tecnología' },
  { usuario: 'cmedina',    email: 'c.medina@et.edu.ar',    dni: '20000009', nombre: 'Claudia Medina',   role: Role.DOCENTE, curso: null, legajo: 'DOC-0009', apellido: 'Medina',    telefono: '3624100009', especialidad: 'Nivel Inicial' },
  { usuario: 'pquiroga',   email: 'p.quiroga@et.edu.ar',   dni: '20000010', nombre: 'Pablo Quiroga',    role: Role.DOCENTE, curso: null, legajo: 'DOC-0010', apellido: 'Quiroga',   telefono: '3624100010', especialidad: 'Historia y Formación Ciudadana' },
  { usuario: 'lcastro',    email: 'l.castro@et.edu.ar',    dni: '20000011', nombre: 'Lorena Castro',    role: Role.DOCENTE, curso: null, legajo: 'DOC-0011', apellido: 'Castro',    telefono: '3624100011', especialidad: 'Lengua (Primaria)' },
  { usuario: 'mherrera',   email: 'm.herrera@et.edu.ar',   dni: '20000012', nombre: 'Martín Herrera',   role: Role.DOCENTE, curso: null, legajo: 'DOC-0012', apellido: 'Herrera',   telefono: '3624100012', especialidad: 'Matemática (Primaria)' },
  { usuario: 'sdominguez', email: 's.dominguez@et.edu.ar', dni: '20000013', nombre: 'Sergio Domínguez', role: Role.DOCENTE, curso: null, legajo: 'DOC-0013', apellido: 'Domínguez', telefono: '3624100013', especialidad: 'Geografía y Economía' },
  { usuario: 'nvega',      email: 'n.vega@et.edu.ar',      dni: '20000014', nombre: 'Natalia Vega',     role: Role.DOCENTE, curso: null, legajo: 'DOC-0014', apellido: 'Vega',      telefono: '3624100014', especialidad: 'Biología y Ciencias Naturales' },

  { usuario: 'fbarrabino', email: 'f.barrabino@et.edu.ar', dni: '40000001', nombre: 'Franco Barrabino',   role: Role.ESTUDIANTE, curso: 'Secundaria — 1° año', legajo: 'LEG-0001', apellido: 'Barrabino', fechaNacimiento: new Date('2011-03-14'), domicilio: 'Av. Sarmiento 1450, Resistencia', telefono: '3624000001' },
  { usuario: 'jperez',     email: 'j.perez@et.edu.ar',     dni: '40000002', nombre: 'Juan Pérez',         role: Role.ESTUDIANTE, curso: 'Secundaria — 1° año', legajo: 'LEG-0002', apellido: 'Pérez', fechaNacimiento: new Date('2011-06-02'), domicilio: 'Ruta 63 Km 4, Resistencia', telefono: '3624000002' },
  { usuario: 'mgomez',     email: 'm.gomez@et.edu.ar',     dni: '40000003', nombre: 'María Gómez',        role: Role.ESTUDIANTE, curso: 'Primaria — 6° grado', legajo: 'LEG-0003', apellido: 'Gómez', fechaNacimiento: new Date('2014-01-22'), domicilio: 'Calle 9 de Julio 220, Resistencia', telefono: '3624000003' },
  { usuario: 'lferreyra',  email: 'l.ferreyra@et.edu.ar',  dni: '40000004', nombre: 'Lucía Ferreyra',     role: Role.ESTUDIANTE, curso: 'Secundaria — 2° año', legajo: 'LEG-0004', apellido: 'Ferreyra', fechaNacimiento: new Date('2010-09-30'), domicilio: 'Av. 25 de Mayo 880, Resistencia', telefono: '3624000004' },
  { usuario: 'srodriguez', email: 's.rodriguez@et.edu.ar', dni: '40000005', nombre: 'Sofía Rodríguez',    role: Role.ESTUDIANTE, curso: 'Secundaria — 3° año', legajo: 'LEG-0005', apellido: 'Rodríguez', fechaNacimiento: new Date('2009-11-11'), domicilio: 'Calle Pellegrini 340, Resistencia', telefono: '3624000005' },
  { usuario: 'tmoreno',    email: 't.moreno@et.edu.ar',    dni: '40000006', nombre: 'Tomás Moreno',       role: Role.ESTUDIANTE, curso: 'Primaria — 5° grado', legajo: 'LEG-0006', apellido: 'Moreno', fechaNacimiento: new Date('2015-04-18'), domicilio: 'Calle Necochea 512, Resistencia', telefono: '3624000006' },
  { usuario: 'vsanchez',   email: 'v.sanchez@et.edu.ar',   dni: '40000007', nombre: 'Valentina Sánchez',  role: Role.ESTUDIANTE, curso: 'Secundaria — 1° año', legajo: 'LEG-0007', apellido: 'Sánchez', fechaNacimiento: new Date('2011-07-25'), domicilio: 'Av. Alberdi 1290, Resistencia', telefono: '3624000007' },
  { usuario: 'iflores',    email: 'i.flores@et.edu.ar',    dni: '40000008', nombre: 'Ignacio Flores',     role: Role.ESTUDIANTE, curso: 'Primaria — 6° grado', legajo: 'LEG-0008', apellido: 'Flores', fechaNacimiento: new Date('2014-02-09'), domicilio: 'Calle Güemes 78, Resistencia', telefono: '3624000008' },
  { usuario: 'nruiz',      email: 'n.ruiz@et.edu.ar',      dni: '40000009', nombre: 'Nicolás Ruiz',       role: Role.ESTUDIANTE, curso: 'Secundaria — 4° año',   legajo: 'LEG-0009', apellido: 'Ruiz',    fechaNacimiento: new Date('2008-05-03'), domicilio: 'Av. Castelli 950, Resistencia',     telefono: '3624000009' },
  { usuario: 'cgimenez',   email: 'c.gimenez@et.edu.ar',   dni: '40000010', nombre: 'Camila Giménez',     role: Role.ESTUDIANTE, curso: 'Secundaria — 5° año',   legajo: 'LEG-0010', apellido: 'Giménez', fechaNacimiento: new Date('2007-08-19'), domicilio: 'Calle French 410, Resistencia',     telefono: '3624000010' },
  { usuario: 'bortiz',     email: 'b.ortiz@et.edu.ar',     dni: '40000011', nombre: 'Bruno Ortiz',        role: Role.ESTUDIANTE, curso: 'Secundaria — 2° año',   legajo: 'LEG-0011', apellido: 'Ortiz',   fechaNacimiento: new Date('2010-02-11'), domicilio: 'Av. Avalos 1720, Resistencia',      telefono: '3624000011' },
  { usuario: 'mcabrera',   email: 'm.cabrera@et.edu.ar',   dni: '40000012', nombre: 'Milagros Cabrera',   role: Role.ESTUDIANTE, curso: 'Secundaria — 3° año',   legajo: 'LEG-0012', apellido: 'Cabrera', fechaNacimiento: new Date('2009-06-27'), domicilio: 'Calle Obligado 655, Resistencia',   telefono: '3624000012' },
  { usuario: 'aluna',      email: 'a.luna@et.edu.ar',      dni: '40000013', nombre: 'Agustina Luna',      role: Role.ESTUDIANTE, curso: 'Primaria — 1° grado',   legajo: 'LEG-0013', apellido: 'Luna',    fechaNacimiento: new Date('2019-09-05'), domicilio: 'Calle Brown 330, Resistencia',      telefono: '3624000013' },
  { usuario: 'fluna',      email: 'f.luna@et.edu.ar',      dni: '40000014', nombre: 'Facundo Luna',       role: Role.ESTUDIANTE, curso: 'Primaria — 3° grado',   legajo: 'LEG-0014', apellido: 'Luna',    fechaNacimiento: new Date('2017-03-21'), domicilio: 'Calle Brown 330, Resistencia',      telefono: '3624000014' },
  { usuario: 'etorres',    email: 'e.torres@et.edu.ar',    dni: '40000015', nombre: 'Emilia Torres',      role: Role.ESTUDIANTE, curso: 'Primaria — 2° grado',   legajo: 'LEG-0015', apellido: 'Torres',  fechaNacimiento: new Date('2018-07-14'), domicilio: 'Av. Hernandarias 2100, Resistencia', telefono: '3624000015' },
  { usuario: 'rortiz',     email: 'r.ortiz@et.edu.ar',     dni: '40000016', nombre: 'Ramiro Ortiz',       role: Role.ESTUDIANTE, curso: 'Primaria — 4° grado',   legajo: 'LEG-0016', apellido: 'Ortiz',   fechaNacimiento: new Date('2016-10-02'), domicilio: 'Av. Avalos 1720, Resistencia',      telefono: '3624000016' },
  { usuario: 'jtorres',    email: 'j.torres@et.edu.ar',    dni: '40000017', nombre: 'Joaquín Torres',     role: Role.ESTUDIANTE, curso: 'Inicial — Sala de 5',   legajo: 'LEG-0017', apellido: 'Torres',  fechaNacimiento: new Date('2021-04-12'), domicilio: 'Av. Hernandarias 2100, Resistencia', telefono: '3624000017' },
  { usuario: 'ocabrera',   email: 'o.cabrera@et.edu.ar',   dni: '40000018', nombre: 'Olivia Cabrera',     role: Role.ESTUDIANTE, curso: 'Inicial — Sala de 3',   legajo: 'LEG-0018', apellido: 'Cabrera', fechaNacimiento: new Date('2023-01-30'), domicilio: 'Calle Obligado 655, Resistencia',   telefono: '3624000018' },

  { usuario: 'pbarrabino', email: 'p.barrabino@et.edu.ar', dni: '30000001', nombre: 'Patricia Barrabino', role: Role.PADRE, curso: null, canalNotificacion: CanalNotificacion.EMAIL },
  { usuario: 'rperez',     email: 'r.perez@et.edu.ar',     dni: '30000002', nombre: 'Roberto Pérez',      role: Role.PADRE, curso: null },
  { usuario: 'mgomezp',    email: 'm.gomez.padre@et.edu.ar', dni: '30000003', nombre: 'Mariana Gómez',    role: Role.PADRE, curso: null },
  { usuario: 'aferreyra',  email: 'a.ferreyra@et.edu.ar',  dni: '30000004', nombre: 'Adriana Ferreyra',  role: Role.PADRE, curso: null, canalNotificacion: CanalNotificacion.EMAIL },
  { usuario: 'hrodriguez', email: 'h.rodriguez@et.edu.ar', dni: '30000005', nombre: 'Hernán Rodríguez',  role: Role.PADRE, curso: null },
  { usuario: 'smoreno',    email: 's.moreno@et.edu.ar',    dni: '30000006', nombre: 'Silvia Moreno',     role: Role.PADRE, curso: null, canalNotificacion: CanalNotificacion.EMAIL },
  { usuario: 'gsanchez',   email: 'g.sanchez@et.edu.ar',   dni: '30000007', nombre: 'Gabriel Sánchez',   role: Role.PADRE, curso: null },
  { usuario: 'mruiz',      email: 'm.ruiz@et.edu.ar',      dni: '30000008', nombre: 'Marcelo Ruiz',      role: Role.PADRE, curso: null },
  { usuario: 'egimenez',   email: 'e.gimenez@et.edu.ar',   dni: '30000009', nombre: 'Elena Giménez',     role: Role.PADRE, curso: null, canalNotificacion: CanalNotificacion.EMAIL },
  { usuario: 'cortiz',     email: 'c.ortiz@et.edu.ar',     dni: '30000010', nombre: 'Carlos Ortiz',      role: Role.PADRE, curso: null },
  { usuario: 'pcabrera',   email: 'p.cabrera@et.edu.ar',   dni: '30000011', nombre: 'Paula Cabrera',     role: Role.PADRE, curso: null, canalNotificacion: CanalNotificacion.EMAIL },
  { usuario: 'dluna',      email: 'd.luna@et.edu.ar',      dni: '30000012', nombre: 'Daniela Luna',      role: Role.PADRE, curso: null },
  { usuario: 'rtorres',    email: 'r.torres@et.edu.ar',    dni: '30000013', nombre: 'Ricardo Torres',    role: Role.PADRE, curso: null },
];

// ---- Deportes, grupos de deporte, transporte y comedor ----
const DEPORTES = ['Fútbol', 'Vóley', 'Básquet', 'Handball', 'Hockey', 'Atletismo', 'Natación', 'Ajedrez'] as const;

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
  // Grupos agregados para tener un catálogo amplio. Un mismo docente no
  // tiene dos grupos superpuestos.
  { deporte: 'Fútbol',    nivel: 'Secundaria', diaSemana: DiaSemana.JUEVES,    horaInicio: '16:00', horaFin: '17:30', docente: 'gacosta' },
  { deporte: 'Vóley',     nivel: 'Primaria',   diaSemana: DiaSemana.JUEVES,    horaInicio: '14:00', horaFin: '15:00', docente: 'csilva' },
  { deporte: 'Básquet',   nivel: 'Secundaria', diaSemana: DiaSemana.LUNES,     horaInicio: '15:00', horaFin: '16:30', docente: 'gacosta' },
  { deporte: 'Handball',  nivel: 'Secundaria', diaSemana: DiaSemana.VIERNES,   horaInicio: '15:00', horaFin: '16:30', docente: 'gacosta' },
  { deporte: 'Handball',  nivel: 'Primaria',   diaSemana: DiaSemana.MARTES,    horaInicio: '14:00', horaFin: '15:00', docente: 'amartinez' },
  { deporte: 'Hockey',    nivel: 'Secundaria', diaSemana: DiaSemana.LUNES,     horaInicio: '17:00', horaFin: '18:30', docente: 'gacosta' },
  { deporte: 'Hockey',    nivel: 'Primaria',   diaSemana: DiaSemana.MIERCOLES, horaInicio: '15:00', horaFin: '16:00', docente: 'amartinez' },
  { deporte: 'Atletismo', nivel: 'Inicial',    diaSemana: DiaSemana.VIERNES,   horaInicio: '10:00', horaFin: '11:00', docente: 'cmedina' },
  { deporte: 'Atletismo', nivel: 'Secundaria', diaSemana: DiaSemana.MIERCOLES, horaInicio: '16:00', horaFin: '17:30', docente: 'gacosta' },
  { deporte: 'Natación',  nivel: 'Primaria',   diaSemana: DiaSemana.JUEVES,    horaInicio: '16:00', horaFin: '17:00', docente: 'amartinez' },
  { deporte: 'Natación',  nivel: 'Inicial',    diaSemana: DiaSemana.MARTES,    horaInicio: '10:00', horaFin: '11:00', docente: 'cmedina' },
  { deporte: 'Ajedrez',   nivel: 'Primaria',   diaSemana: DiaSemana.LUNES,     horaInicio: '16:00', horaFin: '17:00', docente: 'dbenitez' },
  { deporte: 'Ajedrez',   nivel: 'Secundaria', diaSemana: DiaSemana.JUEVES,    horaInicio: '14:00', horaFin: '15:30', docente: 'dbenitez' },
];

const RECORRIDOS_TRANSPORTE = [
  { nombre: 'Recorrido Norte', horaSalida: '07:00', horaRegreso: '17:30' },
  { nombre: 'Recorrido Sur', horaSalida: '07:10', horaRegreso: '17:40' },
  { nombre: 'Recorrido Este', horaSalida: '07:20', horaRegreso: '17:50' },
  { nombre: 'Recorrido Oeste', horaSalida: '07:30', horaRegreso: '18:00' },
];

const TURNOS_COMEDOR = [
  { nombre: 'Primer turno', horaInicio: '12:00', horaFin: '13:00' },
  { nombre: 'Segundo turno', horaInicio: '13:00', horaFin: '14:00' },
  { nombre: 'Turno extendido', horaInicio: '14:00', horaFin: '15:00' },
  { nombre: 'Desayuno', horaInicio: '08:00', horaFin: '08:30' },
  { nombre: 'Merienda', horaInicio: '16:00', horaFin: '16:30' },
];

// ---- Inscripciones de ejemplo a Deportes / Transporte / Comedor ----
// fbarrabino queda con 2 deportes sin solapamiento (útil para probar a
// mano el tope de RF-18 y el rechazo por solapamiento de RF-21: cualquier
// 3er grupo de Secundaria que se intente agregar, o un grupo que caiga el
// mismo día, debe rechazarse), más transporte y comedor. jperez y mgomez
// quedan con un solo deporte cada uno, para probar el caso de "todavía
// tiene lugar para un 2do deporte".
type InscripcionDeporteSeed = {
  estudiante: string;
  deporte: (typeof DEPORTES)[number];
  nivel: (typeof NIVELES)[number];
  diaSemana: DiaSemana;
  horaInicio: string;
  horaFin: string;
};

const INSCRIPCIONES_DEPORTE: InscripcionDeporteSeed[] = [
  { estudiante: 'fbarrabino', deporte: 'Fútbol', nivel: 'Secundaria', diaSemana: DiaSemana.MARTES, horaInicio: '15:00', horaFin: '16:30' },
  { estudiante: 'fbarrabino', deporte: 'Vóley', nivel: 'Secundaria', diaSemana: DiaSemana.MIERCOLES, horaInicio: '14:00', horaFin: '15:00' },
  { estudiante: 'jperez', deporte: 'Fútbol', nivel: 'Secundaria', diaSemana: DiaSemana.MARTES, horaInicio: '15:00', horaFin: '16:30' },
  { estudiante: 'mgomez', deporte: 'Básquet', nivel: 'Primaria', diaSemana: DiaSemana.VIERNES, horaInicio: '13:30', horaFin: '14:30' },
  // El resto respeta las mismas reglas: máximo 2 deportes y sin superposición.
  { estudiante: 'jperez',     deporte: 'Ajedrez',   nivel: 'Secundaria', diaSemana: DiaSemana.JUEVES,    horaInicio: '14:00', horaFin: '15:30' },
  { estudiante: 'mgomez',     deporte: 'Vóley',     nivel: 'Primaria',   diaSemana: DiaSemana.JUEVES,    horaInicio: '14:00', horaFin: '15:00' },
  { estudiante: 'lferreyra',  deporte: 'Handball',  nivel: 'Secundaria', diaSemana: DiaSemana.VIERNES,   horaInicio: '15:00', horaFin: '16:30' },
  { estudiante: 'lferreyra',  deporte: 'Hockey',    nivel: 'Secundaria', diaSemana: DiaSemana.LUNES,     horaInicio: '17:00', horaFin: '18:30' },
  { estudiante: 'srodriguez', deporte: 'Atletismo', nivel: 'Secundaria', diaSemana: DiaSemana.MIERCOLES, horaInicio: '16:00', horaFin: '17:30' },
  { estudiante: 'vsanchez',   deporte: 'Vóley',     nivel: 'Secundaria', diaSemana: DiaSemana.MIERCOLES, horaInicio: '14:00', horaFin: '15:00' },
  { estudiante: 'vsanchez',   deporte: 'Básquet',   nivel: 'Secundaria', diaSemana: DiaSemana.LUNES,     horaInicio: '15:00', horaFin: '16:30' },
  { estudiante: 'tmoreno',    deporte: 'Natación',  nivel: 'Primaria',   diaSemana: DiaSemana.JUEVES,    horaInicio: '16:00', horaFin: '17:00' },
  { estudiante: 'tmoreno',    deporte: 'Handball',  nivel: 'Primaria',   diaSemana: DiaSemana.MARTES,    horaInicio: '14:00', horaFin: '15:00' },
  { estudiante: 'iflores',    deporte: 'Ajedrez',   nivel: 'Primaria',   diaSemana: DiaSemana.LUNES,     horaInicio: '16:00', horaFin: '17:00' },
  { estudiante: 'iflores',    deporte: 'Hockey',    nivel: 'Primaria',   diaSemana: DiaSemana.MIERCOLES, horaInicio: '15:00', horaFin: '16:00' },
  { estudiante: 'nruiz',      deporte: 'Fútbol',    nivel: 'Secundaria', diaSemana: DiaSemana.JUEVES,    horaInicio: '16:00', horaFin: '17:30' },
  { estudiante: 'nruiz',      deporte: 'Hockey',    nivel: 'Secundaria', diaSemana: DiaSemana.LUNES,     horaInicio: '17:00', horaFin: '18:30' },
  { estudiante: 'cgimenez',   deporte: 'Ajedrez',   nivel: 'Secundaria', diaSemana: DiaSemana.JUEVES,    horaInicio: '14:00', horaFin: '15:30' },
  { estudiante: 'bortiz',     deporte: 'Fútbol',    nivel: 'Secundaria', diaSemana: DiaSemana.MARTES,    horaInicio: '15:00', horaFin: '16:30' },
  { estudiante: 'bortiz',     deporte: 'Atletismo', nivel: 'Secundaria', diaSemana: DiaSemana.MIERCOLES, horaInicio: '16:00', horaFin: '17:30' },
  { estudiante: 'mcabrera',   deporte: 'Vóley',     nivel: 'Secundaria', diaSemana: DiaSemana.MIERCOLES, horaInicio: '14:00', horaFin: '15:00' },
  { estudiante: 'aluna',      deporte: 'Natación',  nivel: 'Primaria',   diaSemana: DiaSemana.JUEVES,    horaInicio: '16:00', horaFin: '17:00' },
  { estudiante: 'fluna',      deporte: 'Fútbol',    nivel: 'Primaria',   diaSemana: DiaSemana.LUNES,     horaInicio: '14:00', horaFin: '15:30' },
  { estudiante: 'fluna',      deporte: 'Básquet',   nivel: 'Primaria',   diaSemana: DiaSemana.VIERNES,   horaInicio: '13:30', horaFin: '14:30' },
  { estudiante: 'etorres',    deporte: 'Hockey',    nivel: 'Primaria',   diaSemana: DiaSemana.MIERCOLES, horaInicio: '15:00', horaFin: '16:00' },
  { estudiante: 'rortiz',     deporte: 'Handball',  nivel: 'Primaria',   diaSemana: DiaSemana.MARTES,    horaInicio: '14:00', horaFin: '15:00' },
  { estudiante: 'rortiz',     deporte: 'Ajedrez',   nivel: 'Primaria',   diaSemana: DiaSemana.LUNES,     horaInicio: '16:00', horaFin: '17:00' },
  { estudiante: 'jtorres',    deporte: 'Natación',  nivel: 'Inicial',    diaSemana: DiaSemana.MARTES,    horaInicio: '10:00', horaFin: '11:00' },
  { estudiante: 'ocabrera',   deporte: 'Atletismo', nivel: 'Inicial',    diaSemana: DiaSemana.VIERNES,   horaInicio: '10:00', horaFin: '11:00' },
];

// RF-18: 1 de los 4 recorridos por alumno (no se agregan recorridos).
const INSCRIPCIONES_TRANSPORTE: { estudiante: string; recorrido: string }[] = [
  { estudiante: 'fbarrabino', recorrido: 'Recorrido Norte' },
  { estudiante: 'jperez', recorrido: 'Recorrido Sur' },
  { estudiante: 'mgomez', recorrido: 'Recorrido Este' },
  { estudiante: 'iflores', recorrido: 'Recorrido Este' },
  { estudiante: 'lferreyra', recorrido: 'Recorrido Oeste' },
  { estudiante: 'tmoreno', recorrido: 'Recorrido Norte' },
  { estudiante: 'vsanchez', recorrido: 'Recorrido Sur' },
  { estudiante: 'nruiz', recorrido: 'Recorrido Oeste' },
  { estudiante: 'bortiz', recorrido: 'Recorrido Norte' },
  { estudiante: 'rortiz', recorrido: 'Recorrido Norte' },
  { estudiante: 'aluna', recorrido: 'Recorrido Sur' },
  { estudiante: 'fluna', recorrido: 'Recorrido Sur' },
  { estudiante: 'etorres', recorrido: 'Recorrido Este' },
  { estudiante: 'jtorres', recorrido: 'Recorrido Este' },
  { estudiante: 'ocabrera', recorrido: 'Recorrido Oeste' },
];

const INSCRIPCIONES_COMEDOR: { estudiante: string; turno: string }[] = [
  { estudiante: 'fbarrabino', turno: 'Primer turno' },
  { estudiante: 'mgomez', turno: 'Segundo turno' },
  { estudiante: 'jperez', turno: 'Segundo turno' },
  { estudiante: 'tmoreno', turno: 'Primer turno' },
  { estudiante: 'iflores', turno: 'Primer turno' },
  { estudiante: 'srodriguez', turno: 'Turno extendido' },
  { estudiante: 'lferreyra', turno: 'Segundo turno' },
  { estudiante: 'vsanchez', turno: 'Desayuno' },
  { estudiante: 'cgimenez', turno: 'Merienda' },
  { estudiante: 'mcabrera', turno: 'Merienda' },
  { estudiante: 'aluna', turno: 'Primer turno' },
  { estudiante: 'fluna', turno: 'Primer turno' },
  { estudiante: 'etorres', turno: 'Segundo turno' },
  { estudiante: 'rortiz', turno: 'Segundo turno' },
  { estudiante: 'jtorres', turno: 'Desayuno' },
  { estudiante: 'ocabrera', turno: 'Desayuno' },
];

// Los campos de hora de GrupoDeporte, RecorridoTransporte y TurnoComedor son
// @db.Time: Postgres solo persiste la hora, pero Prisma exige un Date
// completo de entrada, por eso se fija una fecha arbitraria (epoch) igual
// para todos los registros.
const horaTime = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

const LINKS = [
  { padre: 'pbarrabino', hijos: ['fbarrabino'] },
  { padre: 'rperez',     hijos: ['jperez'] },
  { padre: 'mgomezp',    hijos: ['mgomez', 'iflores'] },
  { padre: 'aferreyra',  hijos: ['lferreyra'] },
  { padre: 'hrodriguez', hijos: ['srodriguez'] },
  { padre: 'smoreno',    hijos: ['tmoreno'] },
  { padre: 'gsanchez',   hijos: ['vsanchez'] },
  { padre: 'mruiz',      hijos: ['nruiz'] },
  { padre: 'egimenez',   hijos: ['cgimenez'] },
  { padre: 'cortiz',     hijos: ['bortiz', 'rortiz'] },
  { padre: 'pcabrera',   hijos: ['mcabrera', 'ocabrera'] },
  { padre: 'dluna',      hijos: ['aluna', 'fluna'] },
  { padre: 'rtorres',    hijos: ['jtorres', 'etorres'] },
];

// Materias de cada nivel con su docente: se asignan a todos los cursos del
// nivel (salvo las combinaciones materia–curso que ya salen de GRADES).
const MATERIAS_POR_NIVEL: Record<(typeof NIVELES)[number], { materia: string; docente: string }[]> = {
  Inicial: [
    { materia: 'Juego y Expresión', docente: 'cmedina' },
    { materia: 'Iniciación Musical', docente: 'vromero' },
    { materia: 'Expresión Corporal', docente: 'gacosta' },
    { materia: 'Inglés Inicial', docente: 'rfernandez' },
  ],
  Primaria: [
    { materia: 'Matemáticas', docente: 'mherrera' },
    { materia: 'Prácticas del Lenguaje', docente: 'lcastro' },
    { materia: 'Ciencias Naturales', docente: 'nvega' },
    { materia: 'Ciencias Sociales', docente: 'sdominguez' },
    { materia: 'Inglés', docente: 'rfernandez' },
    { materia: 'Educación Física', docente: 'gacosta' },
    { materia: 'Música', docente: 'vromero' },
    { materia: 'Plástica', docente: 'vromero' },
    { materia: 'Tecnología', docente: 'dbenitez' },
    { materia: 'Formación Ética y Ciudadana', docente: 'pquiroga' },
  ],
  Secundaria: [
    { materia: 'Álgebra y Geometría', docente: 'mlopez' },
    { materia: 'Literatura', docente: 'jgarcia' },
    { materia: 'Física', docente: 'csilva' },
    { materia: 'Química', docente: 'csilva' },
    { materia: 'Biología', docente: 'nvega' },
    { materia: 'Historia', docente: 'pquiroga' },
    { materia: 'Geografía', docente: 'sdominguez' },
    { materia: 'Inglés', docente: 'rfernandez' },
    { materia: 'Educación Física', docente: 'gacosta' },
    { materia: 'Informática', docente: 'dbenitez' },
    { materia: 'Formación Ética y Ciudadana', docente: 'pquiroga' },
    { materia: 'Economía', docente: 'sdominguez' },
    { materia: 'Arte', docente: 'vromero' },
  ],
};

// Pseudoaleatorio determinístico: el seed genera siempre los mismos datos.
const hashTexto = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const NOTAS = [6, 7, 7, 8, 8, 8, 9, 9, 10, 5, 4];

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
      canalNotificacion: u.canalNotificacion ?? CanalNotificacion.INTERNA,
      especialidad: u.especialidad ?? null,
      estadoProfesor: u.role === Role.DOCENTE ? ('ACTIVO' as const) : null,
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
  // "<materia>|<curso>" → usuario del docente que la dicta en ese curso.
  const docentePorMateriaCurso = new Map<string, string>();

  for (const g of GRADES) {
    const cursoLabel = cursoLabelByUsername.get(g.estudiante);
    const cursoId = cursoLabel ? cursoIdByLabel.get(cursoLabel) : undefined;
    if (!cursoId) continue;
    docentePorMateriaCurso.set(`${g.materia}|${cursoLabel}`, g.docente);

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

  // Resto del plan: cada materia del nivel en cada curso del nivel.
  for (const nivel of NIVELES) {
    for (const cursoNombre of CURSOS_POR_NIVEL[nivel]) {
      const cursoLabel = `${nivel} — ${cursoNombre}`;
      const cursoId = cursoIdByLabel.get(cursoLabel)!;
      for (const { materia, docente } of MATERIAS_POR_NIVEL[nivel]) {
        if (docentePorMateriaCurso.has(`${materia}|${cursoLabel}`)) continue;
        docentePorMateriaCurso.set(`${materia}|${cursoLabel}`, docente);

        let materiaId = materiaIdByNombre.get(materia);
        if (!materiaId) {
          materiaId = (await prisma.materia.upsert({ where: { nombre: materia }, update: {}, create: { nombre: materia } })).id;
          materiaIdByNombre.set(materia, materiaId);
        }
        seenAsignaciones.add(`${materiaId}-${cursoId}-${uid(docente)}`);
        await prisma.materiaCurso.upsert({
          where: { materiaId_cursoId_docenteId: { materiaId, cursoId, docenteId: uid(docente) } },
          update: {},
          create: { materiaId, cursoId, docenteId: uid(docente) },
        });
      }
    }
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

  const grupoIdByKey = new Map<string, number>();
  for (const g of GRUPOS_DEPORTE) {
    const deporteId = deporteIdByNombre.get(g.deporte)!;
    const nivelId = nivelIdByNombre.get(g.nivel)!;
    const horaInicio = horaTime(g.horaInicio);
    const horaFin = horaTime(g.horaFin);
    const grupo = await prisma.grupoDeporte.upsert({
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
    grupoIdByKey.set(`${g.deporte}|${g.nivel}|${g.diaSemana}|${g.horaInicio}|${g.horaFin}`, grupo.id);
  }

  const recorridoIdByNombre = new Map<string, number>();
  for (const r of RECORRIDOS_TRANSPORTE) {
    const data = { nombre: r.nombre, horaSalida: horaTime(r.horaSalida), horaRegreso: horaTime(r.horaRegreso) };
    const recorrido = await prisma.recorridoTransporte.upsert({ where: { nombre: r.nombre }, update: {}, create: data });
    recorridoIdByNombre.set(r.nombre, recorrido.id);
  }

  const turnoIdByNombre = new Map<string, number>();
  for (const t of TURNOS_COMEDOR) {
    const data = { nombre: t.nombre, horaInicio: horaTime(t.horaInicio), horaFin: horaTime(t.horaFin) };
    const turno = await prisma.turnoComedor.upsert({ where: { nombre: t.nombre }, update: {}, create: data });
    turnoIdByNombre.set(t.nombre, turno.id);
  }

  // Los datos de ejemplo también cumplen RF-18 (máx. 2) y RF-21 (sin superposición).
  for (const u of SEED_USERS) {
    const propias = INSCRIPCIONES_DEPORTE.filter((i) => i.estudiante === u.usuario);
    const superpuestas = propias.some((a, n) =>
      propias.slice(n + 1).some((b) => a.diaSemana === b.diaSemana && a.horaInicio < b.horaFin && b.horaInicio < a.horaFin),
    );
    if (propias.length > 2 || superpuestas) throw new Error(`Inscripciones de ejemplo inválidas para ${u.usuario} (RF-18/RF-21).`);
    // Cada alumno del seed queda exactamente con sus inscripciones de ejemplo:
    // si se le sumó otro deporte a mano, el upsert lo dejaría con 3 (RF-18).
    if (u.role === Role.ESTUDIANTE) {
      const deportes = propias.map((i) => deporteIdByNombre.get(i.deporte)!);
      await prisma.inscripcionDeporte.deleteMany({ where: { estudianteId: uid(u.usuario), deporteId: { notIn: deportes } } });
    }
  }

  for (const i of INSCRIPCIONES_DEPORTE) {
    const grupoId = grupoIdByKey.get(`${i.deporte}|${i.nivel}|${i.diaSemana}|${i.horaInicio}|${i.horaFin}`);
    if (!grupoId) throw new Error(`Grupo de deporte no encontrado para la inscripción de ${i.estudiante} (${i.deporte}/${i.nivel}).`);
    const deporteId = deporteIdByNombre.get(i.deporte)!;
    await prisma.inscripcionDeporte.upsert({
      where: { estudianteId_deporteId: { estudianteId: uid(i.estudiante), deporteId } },
      update: { grupoDeporteId: grupoId },
      create: { estudianteId: uid(i.estudiante), deporteId, grupoDeporteId: grupoId },
    });
  }

  for (const i of INSCRIPCIONES_TRANSPORTE) {
    const recorridoId = recorridoIdByNombre.get(i.recorrido)!;
    await prisma.inscripcionTransporte.upsert({
      where: { estudianteId: uid(i.estudiante) },
      update: { recorridoId },
      create: { estudianteId: uid(i.estudiante), recorridoId },
    });
  }

  for (const i of INSCRIPCIONES_COMEDOR) {
    const turnoId = turnoIdByNombre.get(i.turno)!;
    await prisma.inscripcionComedor.upsert({
      where: { estudianteId: uid(i.estudiante) },
      update: { turnoId },
      create: { estudianteId: uid(i.estudiante), turnoId },
    });
  }

  const today = new Date();
  const dayIso = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  // Notas generadas: cada alumno de Primaria/Secundaria en cada materia de
  // su curso que no tenga nota en GRADES (1er y 2do trimestre).
  const conNota = new Set(GRADES.map((g) => `${g.estudiante}|${g.materia}`));
  const notasGeneradas: GradeSeed[] = [];
  for (const u of SEED_USERS) {
    if (u.role !== Role.ESTUDIANTE || !u.curso || u.curso.startsWith('Inicial')) continue;
    for (const [clave, docente] of docentePorMateriaCurso) {
      const [materia, cursoLabel] = clave.split('|');
      if (cursoLabel !== u.curso || conNota.has(`${u.usuario}|${materia}`)) continue;
      const h = hashTexto(`${u.usuario}|${materia}`);
      notasGeneradas.push(
        { estudiante: u.usuario, docente, materia, instancia: '1er Trimestre', nota: NOTAS[h % NOTAS.length], daysAgo: 40 + (h % 25) },
        { estudiante: u.usuario, docente, materia, instancia: '2do Trimestre', nota: NOTAS[(h >>> 4) % NOTAS.length], daysAgo: 3 + ((h >>> 8) % 15) },
      );
    }
  }
  const todasLasNotas = [...GRADES, ...notasGeneradas];

  await prisma.grade.deleteMany({});
  await prisma.grade.createMany({
    data: todasLasNotas.map((g) => ({
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

  // ---- Notificaciones: la última nota de cada alumno (y a su padre/tutor)
  // y la confirmación de cada inscripción a deporte.
  const nombreDe = new Map(SEED_USERS.map((u) => [u.usuario, u.nombre]));
  const ultimaNota = new Map<string, GradeSeed>();
  for (const g of todasLasNotas) {
    const previa = ultimaNota.get(g.estudiante);
    if (!previa || g.daysAgo < previa.daysAgo) ultimaNota.set(g.estudiante, g);
  }
  const notificaciones: { userId: number; titulo: string; contenido: string; isRead?: boolean }[] = [
    { userId: uid('fbarrabino'), titulo: 'Nueva calificación cargada', contenido: 'María López cargó tu nota de Álgebra (2do Trim).' },
    { userId: uid('jperez'),     titulo: 'Nueva calificación cargada', contenido: 'María López cargó tu nota de Álgebra (2do Trim).' },
    { userId: uid('pbarrabino'), titulo: 'Nueva calificación de tu hijo', contenido: 'Franco tiene una nueva nota cargada en Álgebra.' },
  ];
  for (const [estudiante, g] of ultimaNota) {
    if (estudiante === 'fbarrabino' || estudiante === 'jperez') continue;
    notificaciones.push({
      userId: uid(estudiante),
      titulo: 'Nueva calificación cargada',
      contenido: `${nombreDe.get(g.docente)} cargó tu nota de ${g.materia} (${g.instancia}).`,
      isRead: hashTexto(estudiante) % 3 === 0,
    });
  }
  for (const link of LINKS) {
    if (link.padre === 'pbarrabino') continue;
    for (const hijo of link.hijos) {
      const g = ultimaNota.get(hijo);
      if (!g) continue;
      notificaciones.push({
        userId: uid(link.padre),
        titulo: 'Nueva calificación de tu hijo',
        contenido: `${nombreDe.get(hijo)!.split(' ')[0]} tiene una nueva nota cargada en ${g.materia}.`,
      });
    }
  }
  for (const i of INSCRIPCIONES_DEPORTE) {
    notificaciones.push({
      userId: uid(i.estudiante),
      titulo: 'Inscripción a deporte confirmada',
      contenido: `Quedaste inscripto/a en ${i.deporte} (${i.nivel}), ${i.diaSemana.toLowerCase()} de ${i.horaInicio} a ${i.horaFin}.`,
      isRead: true,
    });
  }
  await prisma.notification.deleteMany({});
  await prisma.notification.createMany({ data: notificaciones });

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
  // Un plan por cada par docente–materia restante.
  const conPlan = new Set(['mlopez|Álgebra y Geometría', 'jgarcia|Literatura', 'csilva|Física']);
  const planes: { docenteId: number; materia: string; titulo: string; objetivos: string; contenidos: string }[] = [];
  for (const [clave, docente] of docentePorMateriaCurso) {
    const [materia, cursoLabel] = clave.split('|');
    if (conPlan.has(`${docente}|${materia}`)) continue;
    conPlan.add(`${docente}|${materia}`);
    const nivel = cursoLabel.split(' — ')[0];
    planes.push({
      docenteId: uid(docente),
      materia,
      titulo: `Plan de Estudios — ${materia} (${nivel})`,
      objetivos: `Que los alumnos de ${nivel} se apropien de los saberes centrales de ${materia}, articulando teoría y práctica, trabajando en equipo y comunicando lo aprendido con claridad.`,
      contenidos: `Unidad 1: Introducción a ${materia}. Unidad 2: Contenidos centrales del año. Unidad 3: Proyecto integrador. Unidad 4: Repaso y evaluación integradora.`,
    });
  }
  await prisma.studyPlan.createMany({ data: planes });

  // ---- Opiniones, solicitudes de inscripción y postulaciones de empleo.
  // Simulan lo que llega por los formularios públicos; se crean solo si
  // faltan, para no tocar lo que ya hayan cargado usuarios reales.
  const opiniones = [
    { nombre: 'Laura Paz', identificacion: 'laura.paz@example.com', rol: 'Padre/Madre', texto: 'Excelente acompañamiento de las maestras. Mi hija va contenta todos los días.', rating: 5, status: ModerationStatus.APROBADO },
    { nombre: 'Martín Sosa', identificacion: 'martin.sosa@example.com', rol: 'Padre/Madre', texto: 'Muy buena comunicación con las familias a través del campus. Las notas se ven al instante.', rating: 5, status: ModerationStatus.APROBADO },
    { nombre: null, identificacion: '38111222', rol: 'Estudiante', texto: 'Los talleres de ajedrez y de informática están buenísimos.', rating: 4, status: ModerationStatus.APROBADO },
    { nombre: 'Carla Benítez', identificacion: 'carla.benitez@example.com', rol: 'Docente', texto: 'Un equipo de trabajo muy humano y con recursos para enseñar.', rating: 5, status: ModerationStatus.APROBADO },
    { nombre: 'Jorge Ledesma', identificacion: 'jorge.ledesma@example.com', rol: 'Padre/Madre', texto: 'El servicio de transporte es puntual y el comedor tiene menús variados.', rating: 4, status: ModerationStatus.APROBADO },
    { nombre: 'Sol Arias', identificacion: '40999111', rol: 'Estudiante', texto: 'Me gustan las actividades deportivas de los jueves.', rating: 4, status: ModerationStatus.APROBADO },
    { nombre: 'Rosa Quintana', identificacion: 'rosa.quintana@example.com', rol: 'Otro', texto: 'Visité la escuela en la jornada de puertas abiertas: instalaciones impecables.', rating: 5, status: ModerationStatus.APROBADO },
    { nombre: 'Ernesto Villalba', identificacion: 'ernesto.villalba@example.com', rol: 'Padre/Madre', texto: 'Estaría bueno sumar más horarios de natación.', rating: 3, status: ModerationStatus.PENDIENTE },
    { nombre: null, identificacion: '41222333', rol: 'Estudiante', texto: 'Quisiera que haya más torneos entre cursos.', rating: 4, status: ModerationStatus.PENDIENTE },
    { nombre: 'Anónimo', identificacion: 'spam@example.com', rol: 'Otro', texto: 'Comprá seguidores baratos en mi página.', rating: 1, status: ModerationStatus.RECHAZADO },
  ];
  for (const o of opiniones) {
    if (await prisma.opinion.findFirst({ where: { identificacion: o.identificacion, texto: o.texto } })) continue;
    await prisma.opinion.create({ data: { ...o, resolvedAt: o.status === ModerationStatus.PENDIENTE ? null : new Date() } });
  }

  const solicitudes = [
    { nombreTutor: 'Andrea Gauna', emailTutor: 'andrea.gauna@example.com', telefonoTutor: '3624551001', nombreEstudiante: 'Tiziano Gauna', nivel: 'Inicial', curso: 'Sala de 4', mensaje: 'Nos mudamos a Resistencia en diciembre.', status: ModerationStatus.PENDIENTE },
    { nombreTutor: 'Pedro Insaurralde', emailTutor: 'pedro.insaurralde@example.com', telefonoTutor: '3624551002', nombreEstudiante: 'Lola Insaurralde', nivel: 'Primaria', curso: '1° grado', mensaje: null, status: ModerationStatus.PENDIENTE },
    { nombreTutor: 'Mónica Zalazar', emailTutor: 'monica.zalazar@example.com', telefonoTutor: '3624551003', nombreEstudiante: 'Benjamín Zalazar', nivel: 'Primaria', curso: '4° grado', mensaje: 'Viene de otra escuela con pase.', status: ModerationStatus.APROBADO },
    { nombreTutor: 'Hugo Maidana', emailTutor: 'hugo.maidana@example.com', telefonoTutor: '3624551004', nombreEstudiante: 'Abril Maidana', nivel: 'Secundaria', curso: '1° año', mensaje: 'Consulta por beca de comedor.', status: ModerationStatus.PENDIENTE },
    { nombreTutor: 'Cecilia Romero', emailTutor: 'cecilia.romero@example.com', telefonoTutor: '3624551005', nombreEstudiante: 'Thiago Romero', nivel: 'Secundaria', curso: '3° año', mensaje: null, status: ModerationStatus.APROBADO },
    { nombreTutor: 'Fabián Godoy', emailTutor: 'fabian.godoy@example.com', telefonoTutor: '3624551006', nombreEstudiante: 'Martina Godoy', nivel: 'Primaria', curso: '2° grado', mensaje: 'Hermana de un alumno actual.', status: ModerationStatus.APROBADO },
    { nombreTutor: 'Liliana Ojeda', emailTutor: 'liliana.ojeda@example.com', telefonoTutor: '3624551007', nombreEstudiante: 'Bautista Ojeda', nivel: 'Secundaria', curso: '5° año', mensaje: 'Pidió la vacante fuera de término.', status: ModerationStatus.RECHAZADO },
    { nombreTutor: 'Ramón Cardozo', emailTutor: 'ramon.cardozo@example.com', telefonoTutor: '3624551008', nombreEstudiante: 'Jazmín Cardozo', nivel: 'Inicial', curso: 'Sala de 5', mensaje: null, status: ModerationStatus.PENDIENTE },
  ];
  for (const s of solicitudes) {
    if (await prisma.inscription.findFirst({ where: { emailTutor: s.emailTutor, nombreEstudiante: s.nombreEstudiante } })) continue;
    await prisma.inscription.create({ data: { ...s, resolvedAt: s.status === ModerationStatus.PENDIENTE ? null : new Date() } });
  }

  const postulaciones = [
    { nombre: 'Valeria Núñez', email: 'valeria.nunez@example.com', puesto: 'Docente', status: ModerationStatus.PENDIENTE },
    { nombre: 'Lucas Galarza', email: 'lucas.galarza@example.com', puesto: 'Docente', status: ModerationStatus.APROBADO },
    { nombre: 'Gisela Ayala', email: 'gisela.ayala@example.com', puesto: 'Administrativo', status: ModerationStatus.PENDIENTE },
    { nombre: 'Oscar Ramírez', email: 'oscar.ramirez@example.com', puesto: 'Mantenimiento', status: ModerationStatus.PENDIENTE },
    { nombre: 'Daiana Sotelo', email: 'daiana.sotelo@example.com', puesto: 'Administrativo', status: ModerationStatus.RECHAZADO },
    { nombre: 'Federico Escobar', email: 'federico.escobar@example.com', puesto: 'Docente', status: ModerationStatus.PENDIENTE },
  ];
  for (const p of postulaciones) {
    if (await prisma.employmentApplication.findFirst({ where: { email: p.email } })) continue;
    await prisma.employmentApplication.create({ data: { ...p, resolvedAt: p.status === ModerationStatus.PENDIENTE ? null : new Date() } });
  }

  const porRol = (r: Role) => SEED_USERS.filter((u) => u.role === r).length;
  console.log('✅ Seed completo. Password de todos los usuarios: 123456');
  console.log(
    `   ${SEED_USERS.length} usuarios (${porRol(Role.DOCENTE)} docentes, ${porRol(Role.ESTUDIANTE)} alumnos, ${porRol(Role.PADRE)} padres) · ` +
    `${nivelIdByNombre.size} niveles · ${cursoIdByLabel.size} cursos · ` +
    `${materiaIdByNombre.size} materias · ${seenAsignaciones.size} asignaciones materia-curso-docente · ` +
    `${todasLasNotas.length} notas · ${asistenciasData.length} asistencias · ${planes.length + 3} planes de estudio · ` +
    `${notificaciones.length} notificaciones · ${opiniones.length} opiniones · ${solicitudes.length} solicitudes · ${postulaciones.length} postulaciones · ` +
    `${deporteIdByNombre.size} deportes · ${GRUPOS_DEPORTE.length} grupos de deporte · ` +
    `${RECORRIDOS_TRANSPORTE.length} recorridos de transporte · ${TURNOS_COMEDOR.length} turnos de comedor · ` +
    `${INSCRIPCIONES_DEPORTE.length} inscripciones a deporte · ${INSCRIPCIONES_TRANSPORTE.length} a transporte · ` +
    `${INSCRIPCIONES_COMEDOR.length} a comedor`,
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
