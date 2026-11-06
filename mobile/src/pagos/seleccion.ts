import type { EstadoItem, ItemFactura } from './tipos';

// Selección de ítems a pagar (RF-50). Solo se eligen ítems que se deben:
// PENDIENTE o VENCIDA. EN_REVISION ya está en otro comprobante activo y
// PAGADA ya se acreditó (el backend responde 409 si se intenta igual).

const ELEGIBLES: EstadoItem[] = ['PENDIENTE', 'VENCIDA'];

export const esElegible = (item: Pick<ItemFactura, 'estado'>) => ELEGIBLES.includes(item.estado);

/** Monto → centavos enteros: las sumas se hacen sin acumular error de float. */
export const aCentavos = (monto: number) => Math.round(monto * 100);

export function totalSeleccionado(items: Pick<ItemFactura, 'id' | 'importe'>[], elegidos: ReadonlySet<number>): number {
  const centavos = items.filter((i) => elegidos.has(i.id)).reduce((acc, i) => acc + aCentavos(i.importe), 0);
  return centavos / 100;
}

export function alternar(elegidos: ReadonlySet<number>, id: number): Set<number> {
  const nuevo = new Set(elegidos);
  if (nuevo.has(id)) nuevo.delete(id);
  else nuevo.add(id);
  return nuevo;
}

/** "Elegir todo lo pendiente": todos los ítems PENDIENTE o VENCIDA de la factura. */
export const todoLoPendiente = (items: ItemFactura[]) => new Set(items.filter(esElegible).map((i) => i.id));

/** Quita de la selección lo que dejó de ser elegible (por ejemplo, después de recargar). */
export const depurar = (items: ItemFactura[], elegidos: ReadonlySet<number>) =>
  new Set(items.filter((i) => esElegible(i) && elegidos.has(i.id)).map((i) => i.id));
