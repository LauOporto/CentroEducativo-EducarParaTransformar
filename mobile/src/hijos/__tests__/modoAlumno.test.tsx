import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import { esAlumno } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import { HijosProvider, useHijos } from '../HijosContext';

// Modo alumno: el alumno entra a la app y gestiona sus propias inscripciones
// ("Cada alumno puede inscribirse a dos deportes…"). La "lista de hijos" es
// su propia ficha (/auth/me) y nunca se consulta /parent/hijos.

let mockAlumno = false;
jest.mock('@/auth/AuthContext', () => ({
  ...jest.requireActual('@/auth/AuthContext'),
  useEsAlumno: () => mockAlumno,
}));
jest.mock('@/lib/api', () => ({ api: jest.fn() }));
const apiMock = api as jest.Mock;

function envoltorio({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <QueryClientProvider client={qc}>
      <HijosProvider>{children}</HijosProvider>
    </QueryClientProvider>
  );
}

beforeEach(() => apiMock.mockReset());

test('esAlumno distingue al alumno del padre', () => {
  expect(esAlumno({ tipo: 'estudiante' })).toBe(true);
  expect(esAlumno({ tipo: 'padre' })).toBe(false);
});

test('alumno: su propia ficha es la única "hija" y no se pide /parent/hijos', async () => {
  mockAlumno = true;
  apiMock.mockResolvedValueOnce({
    exito: true,
    usuario: { id: 7, nombre: 'Franco Barrabino', dni: '40000001', curso: 'Secundaria — 1° año', usuario: 'fbarrabino' },
  });

  const { result } = await renderHook(() => useHijos(), { wrapper: envoltorio });

  await waitFor(() => expect(result.current.cargando).toBe(false));
  expect(apiMock).toHaveBeenCalledWith('/auth/me');
  expect(apiMock).not.toHaveBeenCalledWith('/parent/hijos');
  expect(result.current.hijos).toEqual([
    { id: 7, nombre: 'Franco Barrabino', dni: '40000001', curso: 'Secundaria — 1° año' },
  ]);
  expect(result.current.seleccionado?.id).toBe(7);
});

test('padre: sigue listando sus hijos vinculados', async () => {
  mockAlumno = false;
  apiMock.mockResolvedValueOnce({ exito: true, hijos: [{ id: 7, nombre: 'Franco', dni: '1', curso: null }] });

  const { result } = await renderHook(() => useHijos(), { wrapper: envoltorio });

  await waitFor(() => expect(result.current.cargando).toBe(false));
  expect(apiMock).toHaveBeenCalledWith('/parent/hijos');
  expect(result.current.hijos).toHaveLength(1);
});
