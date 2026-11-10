import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useEsAlumno } from '@/auth/AuthContext';
import { api } from '@/lib/api';
import type { Hijo, RespuestaHijos, RespuestaPerfil } from '@/lib/tipos';

// Hijo seleccionado: todas las pantallas de la app (pagos, inscripciones)
// trabajan sobre un hijo por vez. El backend ya limita la lista a los hijos
// vinculados al padre autenticado (RNF-47). Si entra un alumno, la "lista"
// es él mismo: así Inicio y Servicios funcionan igual, sobre su propia ficha.

const fichaPropia = () =>
  api<RespuestaPerfil>('/auth/me').then(({ usuario: u }): Hijo[] => [
    { id: u.id, nombre: u.nombre, dni: u.dni, curso: u.curso },
  ]);

type ValorHijos = {
  hijos: Hijo[];
  seleccionado: Hijo | null;
  seleccionar: (id: number) => void;
  cargando: boolean;
  error: Error | null;
  recargar: () => Promise<unknown>;
  recargando: boolean;
};

const HijosContext = createContext<ValorHijos | null>(null);

export const CLAVE_HIJOS = ['hijos'] as const;

export function HijosProvider({ children }: { children: ReactNode }) {
  const alumno = useEsAlumno();
  const consulta = useQuery({
    queryKey: [...CLAVE_HIJOS, alumno ? 'propio' : 'vinculados'],
    queryFn: alumno ? fichaPropia : () => api<RespuestaHijos>('/parent/hijos').then((r) => r.hijos),
  });
  const [idElegido, setIdElegido] = useState<number | null>(null);

  const valor = useMemo<ValorHijos>(() => {
    const hijos = consulta.data ?? [];
    // Si el hijo elegido ya no está vinculado, se cae al primero.
    const seleccionado = hijos.find((h) => h.id === idElegido) ?? hijos[0] ?? null;
    return {
      hijos,
      seleccionado,
      seleccionar: setIdElegido,
      cargando: consulta.isPending,
      error: consulta.error,
      recargar: consulta.refetch,
      recargando: consulta.isRefetching,
    };
  }, [consulta.data, consulta.isPending, consulta.error, consulta.refetch, consulta.isRefetching, idElegido]);

  return <HijosContext.Provider value={valor}>{children}</HijosContext.Provider>;
}

export function useHijos(): ValorHijos {
  const valor = useContext(HijosContext);
  if (!valor) throw new Error('useHijos debe usarse dentro de <HijosProvider>.');
  return valor;
}
