import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  cerrarSesion,
  descartarSesionLocal,
  iniciarSesion,
  registrarFinDeSesion,
  renovarSesion,
  type UsuarioSesion,
} from '@/lib/api';
import { leerRefreshToken } from '@/lib/tokenStore';

export type Aviso = { tipo: 'info' | 'exito' | 'error'; texto: string };

type Estado =
  | { estado: 'cargando' }
  | { estado: 'sinConexion'; mensaje: string }
  | { estado: 'sinSesion' }
  | { estado: 'conSesion'; usuario: UsuarioSesion };

type ValorAuth = {
  estado: Estado;
  /** Mensaje para mostrar en el login (sesión vencida, contraseña cambiada…). */
  aviso: Aviso | null;
  mostrarAviso: (aviso: Aviso | null) => void;
  ingresar: (usuario: string, password: string) => Promise<void>;
  salir: () => Promise<void>;
  /** La sesión ya no existe en el servidor (por ejemplo, tras cambiar la contraseña). */
  terminarSesion: (aviso: Aviso) => Promise<void>;
  reintentar: () => void;
};

const AuthContext = createContext<ValorAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<Estado>({ estado: 'cargando' });
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [intento, setIntento] = useState(0);

  // Al abrir la app: si hay un refresh guardado, se intenta retomar la sesión
  // (respeta los topes del backend: 24 h desde el login y 30 min sin uso).
  useEffect(() => {
    let cancelado = false;
    (async () => {
      const guardado = await leerRefreshToken();
      if (!guardado) {
        if (!cancelado) setEstado({ estado: 'sinSesion' });
        return;
      }
      try {
        const usuario = await renovarSesion();
        if (!cancelado) setEstado({ estado: 'conSesion', usuario });
      } catch (err) {
        if (cancelado) return;
        if (err instanceof ApiError && err.status !== 0) {
          setAviso({ tipo: 'info', texto: err.message });
          setEstado({ estado: 'sinSesion' });
        } else {
          setEstado({ estado: 'sinConexion', mensaje: err instanceof Error ? err.message : 'Sin conexión.' });
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [intento]);

  const terminarSesion = useCallback(
    async (nuevoAviso: Aviso) => {
      await descartarSesionLocal();
      queryClient.clear();
      setAviso(nuevoAviso);
      setEstado({ estado: 'sinSesion' });
    },
    [queryClient],
  );

  // Cuando una request no puede renovar la sesión, se vuelve al login con el
  // motivo que dio el servidor.
  useEffect(() => {
    registrarFinDeSesion((motivo) => {
      void terminarSesion({ tipo: 'info', texto: motivo });
    });
  }, [terminarSesion]);

  const valor = useMemo<ValorAuth>(
    () => ({
      estado,
      aviso,
      mostrarAviso: setAviso,
      ingresar: async (usuario, password) => {
        const sesion = await iniciarSesion(usuario.trim(), password);
        setAviso(null);
        setEstado({ estado: 'conSesion', usuario: sesion });
      },
      salir: async () => {
        await cerrarSesion();
        queryClient.clear();
        setAviso({ tipo: 'exito', texto: 'Cerraste sesión.' });
        setEstado({ estado: 'sinSesion' });
      },
      terminarSesion,
      reintentar: () => {
        setEstado({ estado: 'cargando' });
        setIntento((n) => n + 1);
      },
    }),
    [estado, aviso, queryClient, terminarSesion],
  );

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

export function useAuth(): ValorAuth {
  const valor = useContext(AuthContext);
  if (!valor) throw new Error('useAuth debe usarse dentro de <AuthProvider>.');
  return valor;
}

export function useUsuario(): UsuarioSesion {
  const { estado } = useAuth();
  if (estado.estado !== 'conSesion') throw new Error('No hay sesión iniciada.');
  return estado.usuario;
}
