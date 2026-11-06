import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
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
  /** Objeto (se manda como JSON) o FormData (multipart: el runtime pone el Content-Type con el boundary). */
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

// Marca la espera como lenta pasado SLOW_REQUEST_MS (franja "Despertando el
// servidor…") y la corta a los REQUEST_TIMEOUT_MS.
async function conAvisoLento<T>(tarea: (senal: AbortSignal) => Promise<T>): Promise<T> {
  const controlador = new AbortController();
  const timeout = setTimeout(() => controlador.abort(), REQUEST_TIMEOUT_MS);
  let marcadaLenta = false;
  const avisoLento = setTimeout(() => {
    marcadaLenta = true;
    cambiarLentas(1);
  }, SLOW_REQUEST_MS);
  try {
    return await tarea(controlador.signal);
  } finally {
    clearTimeout(timeout);
    clearTimeout(avisoLento);
    if (marcadaLenta) cambiarLentas(-1);
  }
}

function errorDeRed(err: unknown): ApiError {
  const abortada = err instanceof Error && err.name === 'AbortError';
  return new ApiError(
    0,
    abortada
      ? 'El servidor tardó demasiado en responder. Probá de nuevo en unos segundos.'
      : 'No pudimos conectarnos con el servidor. Revisá tu conexión a internet.',
  );
}

type CuerpoError = { error?: string; message?: string; details?: Record<string, string[]> };

async function errorDeRespuesta(respuesta: Response): Promise<ApiError> {
  const datos = (await respuesta.json().catch(() => null)) as CuerpoError | null;
  return new ApiError(
    respuesta.status,
    datos?.message ?? `Error inesperado del servidor (${respuesta.status}).`,
    datos?.error,
    datos?.details,
  );
}

const esFormData = (body: unknown): body is FormData => typeof FormData !== 'undefined' && body instanceof FormData;

async function pedir<T>(ruta: string, { method = 'GET', body, auth = true }: Opciones): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Client-Type': 'mobile' };
  const multipart = esFormData(body);
  if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json';
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let respuesta: Response;
  try {
    respuesta = await conAvisoLento((signal) =>
      fetch(`${API_URL}/api${ruta}`, {
        method,
        headers,
        body: multipart ? body : body !== undefined ? JSON.stringify(body) : undefined,
        signal,
      }),
    );
  } catch (err) {
    throw errorDeRed(err);
  }

  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  return (await respuesta.json().catch(() => null)) as T;
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

// Ante un 401 se renueva la sesión una sola vez (renovarSesion es
// single-flight) y se reintenta. Si la renovación es rechazada, la sesión
// terminó y se avisa a AuthContext.
async function conSesionRenovada<T>(intento: () => Promise<T>): Promise<T> {
  try {
    return await intento();
  } catch (err) {
    if (!(err instanceof ApiError && err.status === 401)) throw err;

    try {
      await renovarSesion();
    } catch (errRenovacion) {
      if (errRenovacion instanceof ApiError && (errRenovacion.status === 401 || errRenovacion.status === 403)) {
        alTerminarSesion?.(errRenovacion.message);
      }
      throw errRenovacion;
    }
    return intento();
  }
}

export async function api<T>(ruta: string, opciones: Opciones = {}): Promise<T> {
  if (opciones.auth === false) return pedir<T>(ruta, opciones);
  return conSesionRenovada(() => pedir<T>(ruta, opciones));
}

/**
 * POST multipart/form-data con sesión (por ejemplo, la carga de la
 * transferencia). No fija Content-Type: lo pone el runtime con el boundary.
 */
export function apiMultipart<T>(ruta: string, formData: FormData): Promise<T> {
  return api<T>(ruta, { method: 'POST', body: formData });
}

// --- Descarga de archivos (PDF) -------------------------------------------------

function nombreSeguro(nombre: string): string {
  return nombre.replace(/[^A-Za-z0-9._-]/g, '_') || 'archivo';
}

// File.downloadFileAsync (expo-file-system, API nueva del SDK 58) rechaza un
// status no-2xx con un error "UnableToDownload" cuyo mensaje trae el código
// ("response has status: 401" en Android, "response has status 401" en iOS).
const STATUS_RE = /status:? (\d{3})/;

const MENSAJE_DESCARGA: Record<number, string> = {
  401: 'Iniciá sesión para continuar.',
  403: 'No tenés acceso a este archivo.',
  404: 'El archivo no existe.',
};

async function descargarNativo(url: string, nombre: string): Promise<string> {
  const headers: Record<string, string> = { 'X-Client-Type': 'mobile' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  try {
    const archivo = await conAvisoLento((signal) =>
      File.downloadFileAsync(url, new File(Paths.cache, nombre), { headers, idempotent: true, signal }),
    );
    return archivo.uri;
  } catch (err) {
    const status = Number(STATUS_RE.exec(err instanceof Error ? err.message : '')?.[1] ?? 0);
    if (!status) throw errorDeRed(err);
    throw new ApiError(status, MENSAJE_DESCARGA[status] ?? 'No pudimos descargar el archivo. Probá de nuevo.');
  }
}

async function descargarWeb(url: string): Promise<string> {
  const headers: Record<string, string> = { 'X-Client-Type': 'mobile' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  let respuesta: Response;
  try {
    respuesta = await conAvisoLento((signal) => fetch(url, { headers, signal }));
  } catch (err) {
    throw errorDeRed(err);
  }
  if (!respuesta.ok) throw await errorDeRespuesta(respuesta);
  return URL.createObjectURL(await respuesta.blob());
}

/**
 * Descarga un archivo de la API con la sesión del usuario y devuelve un uri
 * local: en el celular, un archivo en la caché de la app; en la versión web,
 * un object URL del blob. Mismo 401 → renovar → reintento que api().
 */
export function descargarArchivo(ruta: string, nombreSugerido: string): Promise<string> {
  const url = `${API_URL}/api${ruta}`;
  const nombre = nombreSeguro(nombreSugerido);
  return conSesionRenovada(() => (Platform.OS === 'web' ? descargarWeb(url) : descargarNativo(url, nombre)));
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
