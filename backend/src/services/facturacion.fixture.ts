/* eslint-disable @typescript-eslint/no-explicit-any -- soporte de tests: reemplaza modelos de Prisma, igual que los *.test.ts */
import { DiaSemana, EstadoAlumno, Prisma, Role } from '@prisma/client';

import { prisma } from '../db/prisma';

// Base en memoria para los tests de facturación y precios (patrón de
// panelFamilia.facade.test.ts: los modelos de Prisma se reemplazan por
// objetos que leen y escriben estos arrays). Solo implementa lo que usan
// facturacion.service y precios.service.

const D = (v: number | string) => new Prisma.Decimal(v);
const hora = (hhmm: string) => new Date(`1970-01-01T${hhmm}:00.000Z`);

export interface AlumnoMemoria {
  id: number;
  role: Role;
  isActive: boolean;
  estado: EstadoAlumno | null;
  cursoId: number | null;
}

export function crearBaseFacturacion() {
  const db = {
    niveles: [
      { id: 1, nombre: 'Primaria', cuotaMensual: D(220000) },
      { id: 2, nombre: 'Secundaria', cuotaMensual: D(260000) },
    ],
    cursos: [
      { id: 10, nivelId: 1 },
      { id: 20, nivelId: 2 },
    ],
    deportes: [
      { id: 1, nombre: 'Fútbol', precioMensual: D(30000) },
      { id: 2, nombre: 'Vóley', precioMensual: D(28000) },
      { id: 3, nombre: 'Ajedrez', precioMensual: D(0) },
    ],
    docentes: [{ id: 9, nombre: 'Andrés Martínez' }],
    grupos: [
      {
        id: 101,
        deporteId: 1,
        nivelId: 2,
        diaSemana: DiaSemana.MARTES,
        horaInicio: hora('15:00'),
        horaFin: hora('16:30'),
        docenteId: 9,
      },
      {
        id: 102,
        deporteId: 2,
        nivelId: 2,
        diaSemana: DiaSemana.MIERCOLES,
        horaInicio: hora('14:00'),
        horaFin: hora('15:00'),
        docenteId: 9,
      },
      {
        id: 103,
        deporteId: 3,
        nivelId: 2,
        diaSemana: DiaSemana.JUEVES,
        horaInicio: hora('14:00'),
        horaFin: hora('15:30'),
        docenteId: 9,
      },
    ],
    recorridos: [{ id: 4, nombre: 'Recorrido Norte', precioMensual: D(45000) }],
    turnos: [{ id: 5, nombre: 'Primer turno', precioMensual: D(60000) }],
    alumnos: [] as AlumnoMemoria[],
    inscDeporte: [] as { estudianteId: number; deporteId: number; grupoDeporteId: number }[],
    inscTransporte: [] as { estudianteId: number; recorridoId: number }[],
    inscComedor: [] as { estudianteId: number; turnoId: number }[],
    facturas: [] as any[],
    cuotas: [] as any[],
    auditoria: [] as any[],
  };

  const alumnoHidratado = (a: AlumnoMemoria) => {
    const curso = db.cursos.find((c) => c.id === a.cursoId);
    const nivel = curso && db.niveles.find((n) => n.id === curso.nivelId);
    const grupo = (id: number) => {
      const g = db.grupos.find((x) => x.id === id)!;
      return {
        ...g,
        deporte: db.deportes.find((d) => d.id === g.deporteId)!,
        nivel: db.niveles.find((n) => n.id === g.nivelId)!,
        docente: db.docentes.find((d) => d.id === g.docenteId)!,
      };
    };
    const t = db.inscTransporte.find((i) => i.estudianteId === a.id);
    const c = db.inscComedor.find((i) => i.estudianteId === a.id);
    return {
      id: a.id,
      curso: nivel ? { nivel } : null,
      inscripcionesDeporte: db.inscDeporte
        .filter((i) => i.estudianteId === a.id)
        .sort((x, y) => x.grupoDeporteId - y.grupoDeporteId)
        .map((i) => ({ grupoDeporteId: i.grupoDeporteId, grupoDeporte: grupo(i.grupoDeporteId) })),
      inscripcionTransporte: t
        ? { recorridoId: t.recorridoId, recorrido: db.recorridos.find((r) => r.id === t.recorridoId)! }
        : null,
      inscripcionComedor: c ? { turnoId: c.turnoId, turno: db.turnos.find((x) => x.id === c.turnoId)! } : null,
    };
  };

  const facturaModel = {
    findMany: async ({ where }: any) => db.facturas.filter((f) => f.periodo === where.periodo),
    create: async ({ data }: any) => {
      if (db.facturas.some((f) => f.estudianteId === data.estudianteId && f.periodo === data.periodo)) {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      }
      const { cuotas, ...resto } = data;
      const factura = { id: db.facturas.length + 1, estado: 'PENDIENTE', emitidaEn: new Date(), ...resto };
      db.facturas.push(factura);
      for (const c of cuotas.create) {
        db.cuotas.push({ id: db.cuotas.length + 1, facturaId: factura.id, estado: 'PENDIENTE', ...c });
      }
      return { id: factura.id };
    },
    update: async ({ where, data }: any) => {
      const f = db.facturas.find((x) => x.id === where.id)!;
      Object.assign(f, data);
      return { id: f.id, numero: f.numero };
    },
  };

  const catalogo = (filas: { id: number }[]) => ({
    findUnique: async ({ where }: any) => filas.find((f) => f.id === where.id) ?? null,
    update: async ({ where, data }: any) =>
      Object.assign(
        filas.find((f) => f.id === where.id)!,
        data,
      ),
  });

  const modelos: Record<string, unknown> = {
    user: {
      findMany: async ({ where }: any) =>
        db.alumnos
          .filter(
            (a) =>
              a.role === where.role &&
              a.isActive === where.isActive &&
              a.estado === where.estado &&
              (where.cursoId?.not === null ? a.cursoId !== null : true),
          )
          .sort((x, y) => x.id - y.id)
          .map(alumnoHidratado),
    },
    factura: facturaModel,
    nivelEducativo: catalogo(db.niveles),
    deporte: catalogo(db.deportes),
    recorridoTransporte: catalogo(db.recorridos),
    turnoComedor: catalogo(db.turnos),
    auditLog: { create: async ({ data }: any) => db.auditoria.push(data) },
    $transaction: async (fn: any) => fn({ factura: facturaModel }),
  };
  for (const [nombre, value] of Object.entries(modelos)) {
    Object.defineProperty(prisma, nombre, { configurable: true, value });
  }

  // Alumno facturable de Secundaria; los parámetros permiten romper cada
  // condición de A3 por separado.
  const agregarAlumno = (id: number, cambios: Partial<AlumnoMemoria> = {}) => {
    db.alumnos.push({
      id,
      role: Role.ESTUDIANTE,
      isActive: true,
      estado: EstadoAlumno.ACTIVO,
      cursoId: 20,
      ...cambios,
    });
  };

  return { db, agregarAlumno };
}
