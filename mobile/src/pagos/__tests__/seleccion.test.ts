import { alternar, depurar, esElegible, todoLoPendiente, totalSeleccionado } from '../seleccion';
import type { EstadoItem, ItemFactura } from '../tipos';

const item = (id: number, importe: number, estado: EstadoItem): ItemFactura => ({
  id,
  concepto: 'CUOTA',
  descripcion: `Ítem ${id}`,
  importe,
  vencimiento: '2026-11-10',
  estado,
});

const ITEMS = [
  item(1, 260000, 'PENDIENTE'),
  item(2, 32000, 'VENCIDA'),
  item(3, 35000, 'EN_REVISION'),
  item(4, 60000, 'PAGADA'),
];

test('solo se eligen ítems PENDIENTE o VENCIDA', () => {
  expect(ITEMS.map(esElegible)).toEqual([true, true, false, false]);
  expect([...todoLoPendiente(ITEMS)]).toEqual([1, 2]);
});

test('depurar saca de la selección lo que dejó de ser elegible', () => {
  expect([...depurar(ITEMS, new Set([1, 3, 4]))]).toEqual([1]);
});

test('el total se suma en centavos: 0.1 + 0.2 da 0.3 exacto', () => {
  const chicos = [item(1, 0.1, 'PENDIENTE'), item(2, 0.2, 'PENDIENTE')];
  expect(0.1 + 0.2).not.toBe(0.3);
  expect(totalSeleccionado(chicos, new Set([1, 2]))).toBe(0.3);
  expect(totalSeleccionado([item(1, 30000.5, 'PENDIENTE'), item(2, 0.25, 'VENCIDA')], new Set([1, 2]))).toBe(30000.75);
});

test('total de una selección y alternar', () => {
  let elegidos: ReadonlySet<number> = new Set<number>();
  expect(totalSeleccionado(ITEMS, elegidos)).toBe(0);
  elegidos = alternar(elegidos, 1);
  elegidos = alternar(elegidos, 2);
  expect(totalSeleccionado(ITEMS, elegidos)).toBe(292000);
  elegidos = alternar(elegidos, 1);
  expect(totalSeleccionado(ITEMS, elegidos)).toBe(32000);
});
