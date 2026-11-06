import { API_URL, REQUEST_TIMEOUT_MS, SLOW_REQUEST_MS } from './config';
import { borrarRefreshToken, guardarRefreshToken, leerRefreshToken } from './tokenStore';

// Cliente HTTP de la app (contrato de API móvil, PLAN_PARTE3 sección 4):
// - toda request lleva "X-Client-Type: mobile";
// - el access token (15 min) vive solo en memoria;
// - ante un 401 en un endpoint con sesión se renueva una vez con el refresh
//   token guardado y se reintenta; si la renovación falla, la sesión terminó.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type UsuarioSesion = { id: number; nombre: string; tipo: string; token: string };

type RespuestaSesion = { exito: true; usuario: UsuarioSesion; refreshToken?: string };

type Opciones = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** false para los endpoints públicos (login, olvidé mi contraseña). */
  auth?: boolean;
};

let accessToken: string | null = null;
let alTerminarSesion: ((motivo: string) => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

/** La capa de sesión (AuthContext) se entera acá cuando el refresh ya no sirve. */
export function registrarFinDeSesion(callback: (motivo: string) => void) {
  alTerminarSesion = callback;
}

// --- Aviso de servidor lento (Render despertando) ---------------------------

let lentas = 0;
const oyentesLentitud = new Set<() => void>();

function cambiarLentas(delta: number) {
  lentas += delta;
  oyentesLentitud.forEach((oyente) => oyente());
}

export const lentitud = {
  suscribir(oyente: () => void) {
    oyentesLentitud.add(oyente);
    return () => {
      oyentesLentitud.delete(oyente);
    };
  },
  hayLentas: () => lentas > 0,
};

// --- Request base -------------------------------------------------------------

async function pedir<T>(ruta: string, { method = 'GET', body, auth = true }: Opciones): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Client-Type': 'mobile' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), REQUEST_TIMEOUT_MS);
  let marcadaLenta = false;
  const avisoLento = setTimeout(() => {
    marcadaLenta = true;
    cambiarLentas(1);
  }, SLOW_REQUEST_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_URL}/api${ruta}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controlador.signal,
    });
  } catch (err) {
    const abortada = err instanceof Error && err.name === 'AbortError';
    throw new ApiError(
      0,
      abortada
        ? 'El servidor tardó demasiado en responder. Probá de nuevo en unos segundos.'
        : 'No pudimos conectarnos con el servidor. Revisá tu conexión a internet.',
    );
  } finally {
    clearTimeout(timeout);
    clearTimeout(avisoLento);
    if (marcadaLenta) cambiarLentas(-1);
  }

  const datos = (await respuesta.json().catch(() => null)) as
    (T & { error?: string; message?: string; details?: Record<string, string[]> }) | null;

  if (!respuesta.ok) {
    throw new ApiError(
      respuesta.status,
      datos?.message ?? `Error inesperado del servidor (${respuesta.status}).`,
      datos?.error,
      datos?.details,
    );
  }
  return datos as T;
}

// --- Sesión ------------------------------------------------------------------

let renovacionEnCurso: Promise<UsuarioSesion> | null = null;

/**
 * Renueva el access token con el refresh guardado. Si varias requests reciben
 * 401 a la vez, comparten una sola renovación (el backend rota el refresh en
 * cada uso, así que dos renovaciones en paralelo invalidarían la sesión).
 */
export function renovarSesion(): Promise<UsuarioSesion> {
  renovacionEnCurso ??= (async () => {
    try {
      const refreshToken = await leerRefreshToken();
      if (!refreshToken) throw new ApiError(401, 'Iniciá sesión para continuar.');
      const r = await pedir<RespuestaSesion>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        auth: false,
      });
      if (r.refreshToken) await guardarRefreshToken(r.refreshToken);
      setAccessToken(r.usuario.token);
      return r.usuario;
    } catch (err) {
      // Solo un rechazo explícito del servidor cierra la sesión; un corte de
      // red no borra el refresh guardado.
      if (err instanceof ApiError && (err.status === 401 || err.status === 403)) {
        await borrarRefreshToken();
        setAccessToken(null);
      }
      throw err;
    } finally {
      renovacionEnCurso = null;
    }
  })();
  return renovacionEnCurso;
}

export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  try {
    return await pedir<T>(ruta, opciones);
  } catch (err) {
    const conSesion = opciones.auth !== false;
    if (!(conSesion && err instanceof ApiError && err.status === 401)) throw err;

    try {
      await renovarSesion();
    } catch (errRenovacion) {
      if (errRenovacion instanceof ApiError && (errRenovacion.status === 401 || errRenovacion.status === 403)) {
        alTerminarSesion?.(errRenovacion.message);
      }
      throw errRenovacion;
    }
    return pedir<T>(ruta, opciones);
  }
}

export async function iniciarSesion(usuario: string, password: string): Promise<UsuarioSesion> {
  const r = await pedir<RespuestaSesion>('/auth/login', {
    method: 'POST',
    body: { usuario, password },
    auth: false,
  });
  if (!r.refreshToken) throw new ApiError(500, 'El servidor no devolvió la sesión de la app.');
  await guardarRefreshToken(r.refreshToken);
  setAccessToken(r.usuario.token);
  return r.usuario;
}

export async function cerrarSesion(): Promise<void> {
  const refreshToken = await leerRefreshToken();
  await borrarRefreshToken();
  setAccessToken(null);
  // El backend responde 200 siempre; si no hay red, la sesión del servidor
  // vence sola (30 min de inactividad), así que no se reintenta.
  if (refreshToken) {
    await pedir('/auth/logout', { method: 'POST', body: { refreshToken }, auth: false }).catch(() => undefined);
  }
}

/** Limpia la sesión local sin avisar al servidor (la sesión ya no existe allá). */
export async function descartarSesionLocal(): Promise<void> {
  await borrarRefreshToken();
  setAccessToken(null);
}
