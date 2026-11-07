import { mesesElegibles, mesesEntre, rangoDelFiltro, sumarMeses, ultimoDia, validarMeses, type Filtro } from '../rango';

const HOY = '2026-11-06';

describe('presets', () => {
  test('últimos 6 meses: igual al default del backend (hoy − 6 a hoy + 2), por meses completos', () => {
    expect(rangoDelFiltro({ preset: 'ultimos6' }, HOY)).toEqual({
      rango: { desde: '2026-05-01', hasta: '2027-01-31' },
    });
  });

  test('este año y año anterior', () => {
    expect(rangoDelFiltro({ preset: 'esteAnio' }, HOY)).toEqual({
      rango: { desde: '2026-01-01', hasta: '2026-12-31' },
    });
    expect(rangoDelFiltro({ preset: 'anioAnterior' }, HOY)).toEqual({
      rango: { desde: '2025-01-01', hasta: '2025-12-31' },
    });
  });

  test('personalizado: día 1 del mes desde y último día del mes hasta', () => {
    const filtro: Filtro = { preset: 'personalizado', desde: '2026-02', hasta: '2026-02' };
    expect(rangoDelFiltro(filtro, HOY)).toEqual({ rango: { desde: '2026-02-01', hasta: '2026-02-28' } });
    expect(ultimoDia('2028-02')).toBe('2028-02-29');
  });
});

describe('límites (mismas reglas que parseRangoFechas)', () => {
  test('desde posterior a hasta → error', () => {
    expect(validarMeses('2026-10', '2026-09')).toBe('El mes "Desde" no puede ser posterior a "Hasta".');
  });

  test('24 meses entra; 25 no', () => {
    expect(mesesEntre('2025-01', '2026-12')).toBe(24);
    expect(validarMeses('2025-01', '2026-12')).toBeNull();
    expect(rangoDelFiltro({ preset: 'personalizado', desde: '2025-01', hasta: '2027-01' }, HOY)).toEqual({
      error: 'El rango no puede superar los 24 meses.',
    });
  });

  test('lista de meses elegibles: los últimos 24 y los 2 siguientes, del más nuevo al más viejo', () => {
    const meses = mesesElegibles(HOY);
    expect(meses).toHaveLength(26);
    expect(meses[0]).toBe('2027-01');
    expect(meses[2]).toBe('2026-11');
    expect(meses.at(-1)).toBe('2024-12');
  });

  test('sumarMeses cruza años', () => {
    expect(sumarMeses('2026-11', 2)).toBe('2027-01');
    expect(sumarMeses('2026-01', -1)).toBe('2025-12');
  });
});
