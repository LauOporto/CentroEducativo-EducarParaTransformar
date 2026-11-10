import { mensajeCobro, periodoSiguiente } from '../cobroServicios';

test('el período que se factura es el del mes siguiente', () => {
  expect(periodoSiguiente('2026-11-09')).toBe('2026-12');
  expect(periodoSiguiente('2026-12-15')).toBe('2027-01');
  expect(periodoSiguiente('2026-01-31')).toBe('2026-02');
});

test('la confirmación dice el precio y desde qué factura se cobra', () => {
  const texto = mensajeCobro(45000, '2026-11-09');
  expect(texto).toMatch(/45\.000/);
  expect(texto).toContain('factura de diciembre 2026');
  expect(texto).toContain('último día hábil de noviembre');
  expect(texto).toContain('No se paga ahora');
});

test('sin precio fijado no promete un cobro', () => {
  expect(mensajeCobro(0, '2026-11-09')).toBe('Por ahora no tiene costo: la escuela todavía no fijó su precio.');
});
