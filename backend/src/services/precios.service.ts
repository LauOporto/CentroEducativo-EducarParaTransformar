import { AccionAuditoria, Prisma } from '@prisma/client';

import { prisma } from '../db/prisma';
import { HttpError } from '../utils/httpError';
import { toMonto } from '../utils/montos';
import { registrarAuditoria } from './auditoria.service';

// Regla de negocio de la Parte 3: solo el Administrador fija el valor de la
// cuota de cada nivel, de cada deporte, de cada recorrido y de cada turno de
// comedor (las rutas exigen ADMIN). El nuevo valor rige para las facturas
// que se emitan después: las ya emitidas tienen el importe congelado.

export const PRECIO_MAXIMO = new Prisma.Decimal(10_000_000);
export const MSG_PRECIO_INVALIDO = 'El precio debe ser un número entre 0 y 10.000.000, con hasta 2 decimales.';

// Acepta number o string ("25000", "25000.5", 25000.5). Se valida sobre el
// texto, sin pasar por cuentas de float.
export function parsePrecio(valor: unknown): Prisma.Decimal {
  const texto = typeof valor === 'number' && Number.isFinite(valor) ? String(valor) : valor;
  if (typeof texto !== 'string' || !/^\d{1,8}(\.\d{1,2})?$/.test(texto.trim())) {
    throw HttpError.badRequest(MSG_PRECIO_INVALIDO);
  }
  const precio = new Prisma.Decimal(texto.trim());
  if (precio.greaterThan(PRECIO_MAXIMO)) throw HttpError.badRequest(MSG_PRECIO_INVALIDO);
  return precio;
}

// Copia del registro con el campo Decimal expuesto como number (2 decimales).
export function conMonto<T extends object, K extends keyof T>(obj: T, campo: K): Omit<T, K> & Record<K, number> {
  return { ...obj, [campo]: toMonto(obj[campo] as Prisma.Decimal) } as Omit<T, K> & Record<K, number>;
}

interface RegistroPrecio {
  id: number;
  nombre: string;
  valor: Prisma.Decimal;
}

interface Catalogo {
  entidad: string;
  campo: 'cuotaMensual' | 'precioMensual';
  noExiste: string;
  leer: (id: number) => Promise<RegistroPrecio | null>;
  guardar: (id: number, valor: Prisma.Decimal) => Promise<unknown>;
}

const CATALOGOS = {
  nivel: {
    entidad: 'NivelEducativo',
    campo: 'cuotaMensual',
    noExiste: 'El nivel educativo indicado no existe.',
    leer: async (id) => {
      const r = await prisma.nivelEducativo.findUnique({ where: { id } });
      return r && { id: r.id, nombre: r.nombre, valor: r.cuotaMensual };
    },
    guardar: (id, valor) => prisma.nivelEducativo.update({ where: { id }, data: { cuotaMensual: valor } }),
  },
  deporte: {
    entidad: 'Deporte',
    campo: 'precioMensual',
    noExiste: 'El deporte indicado no existe.',
    leer: async (id) => {
      const r = await prisma.deporte.findUnique({ where: { id } });
      return r && { id: r.id, nombre: r.nombre, valor: r.precioMensual };
    },
    guardar: (id, valor) => prisma.deporte.update({ where: { id }, data: { precioMensual: valor } }),
  },
  recorrido: {
    entidad: 'RecorridoTransporte',
    campo: 'precioMensual',
    noExiste: 'El recorrido de transporte indicado no existe.',
    leer: async (id) => {
      const r = await prisma.recorridoTransporte.findUnique({ where: { id } });
      return r && { id: r.id, nombre: r.nombre, valor: r.precioMensual };
    },
    guardar: (id, valor) => prisma.recorridoTransporte.update({ where: { id }, data: { precioMensual: valor } }),
  },
  turno: {
    entidad: 'TurnoComedor',
    campo: 'precioMensual',
    noExiste: 'El turno de comedor indicado no existe.',
    leer: async (id) => {
      const r = await prisma.turnoComedor.findUnique({ where: { id } });
      return r && { id: r.id, nombre: r.nombre, valor: r.precioMensual };
    },
    guardar: (id, valor) => prisma.turnoComedor.update({ where: { id }, data: { precioMensual: valor } }),
  },
} satisfies Record<string, Catalogo>;

export type TipoPrecio = keyof typeof CATALOGOS;

export async function actualizarPrecio(tipo: TipoPrecio, id: number, valor: unknown, usuarioId: number) {
  const catalogo: Catalogo = CATALOGOS[tipo];
  if (!Number.isInteger(id) || id <= 0) throw HttpError.notFound(catalogo.noExiste);
  const precio = parsePrecio(valor);

  const actual = await catalogo.leer(id);
  if (!actual) throw HttpError.notFound(catalogo.noExiste);

  await catalogo.guardar(id, precio);
  await registrarAuditoria({
    usuarioId,
    accion: AccionAuditoria.MODIFICACION,
    entidad: catalogo.entidad,
    entidadId: id,
    detalle: `${catalogo.campo}: ${actual.valor.toFixed(2)} → ${precio.toFixed(2)}`,
  });
  return { id, nombre: actual.nombre, [catalogo.campo]: toMonto(precio) };
}
