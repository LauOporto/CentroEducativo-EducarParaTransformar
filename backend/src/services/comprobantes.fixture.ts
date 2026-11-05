/* eslint-disable @typescript-eslint/no-explicit-any -- soporte de tests: reemplaza modelos de Prisma, igual que los *.test.ts */
import { CanalNotificacion, Prisma, Role } from '@prisma/client';

import { prisma } from '../db/prisma';
import { crearBaseFacturacion } from './facturacion.fixture';
import { generarFacturasPeriodo } from './facturacion.service';

// Base en memoria para el flujo de comprobantes (RF-50). Reutiliza
// facturacion.fixture: las facturas e ítems se emiten con
// generarFacturasPeriodo real (mismos importes y descripciones que en
// producción) y después se reemplazan los modelos que usa el flujo de pago.
// $transaction guarda una copia de las tablas y la restaura si la función
// lanza, como un ROLLBACK.

export const ALUMNO = 7;
export const ALUMNO_OTRO = 8;
export const ADMIN = 1;
export const ADMIN_INACTIVO = 2;
export const PADRE_EMAIL = 50; // vinculado al alumno 7, canal EMAIL
export const PADRE_INTERNA = 51; // vinculado al alumno 7, canal INTERNA
export const PADRE_AJENO = 52; // vinculado al alumno 8
export const DOCENTE = 60;

const usuarioBase = (id: number, role: Role, nombre: string, extra: Record<string, unknown> = {}) => ({
  id,
  role,
  nombre,
  usuario: nombre.toLowerCase().replace(/\s+/g, ''),
  email: `${id}@test.local`,
  isActive: true,
  canalNotificacion: CanalNotificacion.INTERNA,
  legajo: null as string | null,
  curso: null as { nombre: string; nivel: { nombre: string } } | null,
  ...extra,
});

// Igualdad, { in }, { gte, lt }, null, relación "factura" y OR: lo que usan
// los where de comprobantes.service y recalcularEstadoFactura.
function cumple(fila: any, where: any, db: any): boolean {
  if (!where) return true;
  return Object.entries(where).every(([campo, cond]: [string, any]) => {
    if (campo === 'OR') return (cond as any[]).some((w) => cumple(fila, w, db));
    if (campo === 'factura')
      return cumple(
        db.facturas.find((f: any) => f.id === fila.facturaId),
        cond,
        db,
      );
    const v = fila[campo];
    if (cond === null) return v === null || v === undefined;
    if (cond instanceof Date) return v instanceof Date && v.getTime() === cond.getTime();
    if (typeof cond === 'object' && !(cond instanceof Prisma.Decimal)) {
      if ('in' in cond) return cond.in.includes(v);
      if (v === null || v === undefined) return false;
      if ('gte' in cond && !(v >= cond.gte)) return false;
      if ('lt' in cond && !(v < cond.lt)) return false;
      return true;
    }
    return v === cond;
  });
}

const errorUnico = () => Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });

export async function crearBaseComprobantes() {
  const base = crearBaseFacturacion();
  base.agregarAlumno(ALUMNO);
  base.db.inscDeporte.push(
    { estudianteId: ALUMNO, deporteId: 1, grupoDeporteId: 101 },
    { estudianteId: ALUMNO, deporteId: 2, grupoDeporteId: 102 },
  );
  base.db.inscTransporte.push({ estudianteId: ALUMNO, recorridoId: 4 });
  base.db.inscComedor.push({ estudianteId: ALUMNO, turnoId: 5 });
  base.agregarAlumno(ALUMNO_OTRO);
  await generarFacturasPeriodo('2026-10');
  await generarFacturasPeriodo('2026-11');

  const db = {
    facturas: base.db.facturas,
    cuotas: base.db.cuotas,
    comprobantes: [] as any[],
    cpItems: [] as any[],
    pagos: [] as any[],
    notificaciones: [] as any[],
    auditoria: [] as any[],
    usuarios: [
      usuarioBase(ADMIN, Role.ADMIN, 'Admin'),
      usuarioBase(ADMIN_INACTIVO, Role.ADMIN, 'Admin Viejo', { isActive: false }),
      usuarioBase(PADRE_EMAIL, Role.PADRE, 'Patricia Padre', { canalNotificacion: CanalNotificacion.EMAIL }),
      usuarioBase(PADRE_INTERNA, Role.PADRE, 'Pablo Padre'),
      usuarioBase(PADRE_AJENO, Role.PADRE, 'Mariana Ajena'),
      usuarioBase(DOCENTE, Role.DOCENTE, 'Docente'),
      usuarioBase(ALUMNO, Role.ESTUDIANTE, 'Franco Alumno', {
        legajo: 'LEG-0007',
        curso: { nombre: '1° año', nivel: { nombre: 'Secundaria' } },
      }),
      usuarioBase(ALUMNO_OTRO, Role.ESTUDIANTE, 'Otro Alumno', {
        curso: { nombre: '1° año', nivel: { nombre: 'Secundaria' } },
      }),
    ],
    vinculos: [
      { padreId: PADRE_EMAIL, estudianteId: ALUMNO },
      { padreId: PADRE_INTERNA, estudianteId: ALUMNO },
      { padreId: PADRE_AJENO, estudianteId: ALUMNO_OTRO },
    ],
  };

  const usuario = (id: number) => db.usuarios.find((u) => u.id === id) ?? null;
  const cuota = (id: number) => db.cuotas.find((c) => c.id === id);

  const hidratarComprobante = (c: any) => {
    const f = db.facturas.find((x) => x.id === c.facturaId);
    return {
      ...c,
      items: db.cpItems
        .filter((i) => i.comprobanteId === c.id)
        .sort((a, b) => a.id - b.id)
        .map((i) => ({ ...i, cuota: cuota(i.cuotaId) })),
      factura: { ...f, estudiante: usuario(f.estudianteId) },
      generadoPor: usuario(c.generadoPorId),
      pago: db.pagos.find((p) => p.comprobanteId === c.id) ?? null,
    };
  };

  const modelos: Record<string, any> = {
    user: {
      findUnique: async ({ where }: any) => usuario(where.id),
      findMany: async ({ where }: any) => db.usuarios.filter((u) => cumple(u, where, db)),
    },
    parentStudentLink: {
      findUnique: async ({ where }: any) => {
        const { padreId, estudianteId } = where.padreId_estudianteId;
        return db.vinculos.find((v) => v.padreId === padreId && v.estudianteId === estudianteId) ?? null;
      },
      findMany: async ({ where }: any) => db.vinculos.filter((v) => cumple(v, where, db)),
    },
    factura: {
      findUnique: async ({ where, select }: any) => {
        const f = db.facturas.find((x) => x.id === where.id);
        if (!f) return null;
        const filtro = select?.comprobantes?.where;
        return {
          ...f,
          cuotas: db.cuotas.filter((c) => c.facturaId === f.id),
          comprobantes: db.comprobantes
            .filter((c) => c.facturaId === f.id && cumple(c, filtro, db))
            .map((c) => ({ ...c, items: db.cpItems.filter((i) => i.comprobanteId === c.id) })),
          pagos: db.pagos.filter((p) => p.facturaId === f.id),
        };
      },
      update: async ({ where, data }: any) =>
        Object.assign(
          db.facturas.find((f) => f.id === where.id),
          data,
        ),
    },
    cuota: {
      findMany: async ({ where }: any) => db.cuotas.filter((c) => cumple(c, where, db)).sort((a, b) => a.id - b.id),
      updateMany: async ({ where, data }: any) => {
        const filas = db.cuotas.filter((c) => cumple(c, where, db));
        filas.forEach((c) => Object.assign(c, data));
        return { count: filas.length };
      },
    },
    comprobantePago: {
      create: async ({ data }: any) => {
        if (db.comprobantes.some((c) => c.numero === data.numero)) throw errorUnico();
        const { items, ...resto } = data;
        const c = {
          id: db.comprobantes.length + 1,
          estado: 'GENERADO',
          medio: 'TRANSFERENCIA',
          createdAt: new Date(),
          archivoId: null,
          archivoTipo: null,
          nroOperacion: null,
          fechaTransferencia: null,
          montoTransferido: null,
          cargadoEn: null,
          revisadoPorId: null,
          revisadoEn: null,
          motivoRechazo: null,
          ...resto,
        };
        db.comprobantes.push(c);
        for (const i of items.create) db.cpItems.push({ id: db.cpItems.length + 1, comprobanteId: c.id, ...i });
        return { id: c.id };
      },
      update: async ({ where, data }: any) => {
        if (data.numero && db.comprobantes.some((c) => c.numero === data.numero && c.id !== where.id)) {
          throw errorUnico();
        }
        return Object.assign(
          db.comprobantes.find((c) => c.id === where.id),
          data,
        );
      },
      updateMany: async ({ where, data }: any) => {
        const filas = db.comprobantes.filter((c) => cumple(c, where, db));
        filas.forEach((c) => Object.assign(c, data));
        return { count: filas.length };
      },
      findUnique: async ({ where }: any) => {
        const c = db.comprobantes.find((x) => x.id === where.id);
        return c ? hidratarComprobante(c) : null;
      },
      count: async ({ where }: any) => db.comprobantes.filter((c) => cumple(c, where, db)).length,
      findMany: async ({ where, take, skip }: any) =>
        db.comprobantes
          .filter((c) => cumple(c, where, db))
          .sort((a, b) => {
            if (a.cargadoEn && b.cargadoEn) return a.cargadoEn - b.cargadoEn || a.id - b.id;
            if (a.cargadoEn) return -1;
            if (b.cargadoEn) return 1;
            return a.id - b.id;
          })
          .slice(skip ?? 0, (skip ?? 0) + (take ?? 1000))
          .map(hidratarComprobante),
    },
    pago: {
      create: async ({ data }: any) => {
        if (db.pagos.some((p) => p.comprobanteId === data.comprobanteId)) throw errorUnico();
        const p = { id: db.pagos.length + 1, createdAt: new Date(), ...data };
        db.pagos.push(p);
        return { id: p.id };
      },
    },
    notification: { create: async ({ data }: any) => db.notificaciones.push(data) },
    auditLog: { create: async ({ data }: any) => db.auditoria.push(data) },
    $transaction: async (fn: any) => {
      const tablas = ['facturas', 'cuotas', 'comprobantes', 'cpItems', 'pagos'] as const;
      const copia = Object.fromEntries(tablas.map((t) => [t, db[t].map((fila: any) => ({ ...fila }))]));
      try {
        return await fn(prisma);
      } catch (err) {
        for (const t of tablas) db[t].splice(0, db[t].length, ...copia[t]);
        throw err;
      }
    },
  };
  for (const [nombre, value] of Object.entries(modelos)) {
    Object.defineProperty(prisma, nombre, { configurable: true, value });
  }

  const factura = (periodo: string, estudianteId = ALUMNO) =>
    db.facturas.find((f) => f.periodo === periodo && f.estudianteId === estudianteId)!;
  const items = (facturaId: number) => db.cuotas.filter((c) => c.facturaId === facturaId).sort((a, b) => a.id - b.id);

  return { db, factura, items };
}

// Usuarios autenticados (req.authUser) para llamar a los servicios.
export const actor = (id: number, role: Role) => ({ id, role, usuario: `u${id}` });
export const PADRE_ACTOR = actor(PADRE_EMAIL, Role.PADRE);
export const ADMIN_ACTOR = actor(ADMIN, Role.ADMIN);

// Archivos de prueba con la firma real de cada formato.
export const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
export const JPG_MINIMO = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
export const PDF_MINIMO = Buffer.from('%PDF-1.4\n%%EOF\n', 'latin1');
