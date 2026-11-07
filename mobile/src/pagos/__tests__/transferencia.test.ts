import {
  centavosDeTexto,
  desdeDMA,
  mascaraFecha,
  montoParaCampo,
  tipoDeArchivo,
  validarFecha,
  validarMonto,
  validarNroOperacion,
  validarTamano,
} from '../transferencia';

const HOY = '2026-11-06';

test('N.º de operación: 4 a 40 letras, números y guiones', () => {
  expect(validarNroOperacion('OP-123456')).toBeNull();
  expect(validarNroOperacion('abc')).not.toBeNull();
  expect(validarNroOperacion('OP 123')).not.toBeNull();
  expect(validarNroOperacion('A'.repeat(41))).not.toBeNull();
});

test('fecha DD/MM/AAAA: real, no futura y no anterior a 60 días', () => {
  expect(mascaraFecha('06112026')).toBe('06/11/2026');
  expect(desdeDMA('31/02/2026')).toBeNull();
  expect(validarFecha('06/11/2026', HOY)).toEqual({ fecha: '2026-11-06' });
  expect(validarFecha('07/11/2026', HOY)).toEqual({ error: 'La fecha de la transferencia no puede ser futura.' });
  expect(validarFecha('07/09/2026', HOY)).toEqual({ fecha: '2026-09-07' });
  expect(validarFecha('06/09/2026', HOY)).toEqual({
    error: 'La fecha de la transferencia no puede tener más de 60 días.',
  });
});

test('monto: exactamente el total, escrito como lo escribe la gente', () => {
  expect(montoParaCampo(290000)).toBe('290000,00');
  expect(centavosDeTexto('290.000,50')).toBe(29000050);
  expect(centavosDeTexto('$ 290.000')).toBe(29000000);
  expect(validarMonto('290000,00', 290000)).toEqual({ monto: '290000.00' });
  expect(validarMonto('290000.5', 290000.5)).toEqual({ monto: '290000.50' });
  expect(validarMonto('289999', 290000)).toEqual({ error: 'El monto tiene que ser exactamente $ 290.000,00.' });
  expect(validarMonto('mucho', 290000)).toHaveProperty('error');
});

test('archivo: JPG, PNG o PDF de hasta 5 MB', () => {
  expect(tipoDeArchivo('image/jpeg', 'x')).toBe('image/jpeg');
  expect(tipoDeArchivo(undefined, 'foto.PNG')).toBe('image/png');
  expect(tipoDeArchivo('image/heic', 'foto.heic')).toBeNull();
  expect(tipoDeArchivo(undefined, 'transferencia.pdf')).toBe('application/pdf');
  expect(validarTamano(5 * 1024 * 1024)).toBeNull();
  expect(validarTamano(5 * 1024 * 1024 + 1)).toMatch(/supera el máximo de 5 MB/);
  expect(validarTamano(undefined)).toBeNull();
});
