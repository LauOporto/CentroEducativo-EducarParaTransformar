import { createHash, createHmac, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { v2 as cloudinary } from 'cloudinary';
import jwt from 'jsonwebtoken';

import { env } from '../config/env';
import { HttpError } from '../utils/httpError';
import { logger } from '../utils/logger';
import { sinBarrasFinales } from '../utils/texto';

// D6 (RNF-47, Ley 25.326): los comprobantes de transferencia son datos
// personales y bancarios. Nunca se guardan con URL pública: se guarda un id
// (public_id privado en Cloudinary o nombre de archivo local) y se sirven
// con una URL temporal de 5 minutos. Tres drivers detrás de una misma
// interfaz; el resto del backend no sabe cuál está activo.

export type DriverAlmacenamiento = 'cloudinary' | 'local' | 'memoria';

export interface ArchivoGuardado {
  archivoId: string;
  archivoTipo: string; // mime: image/jpeg, image/png o application/pdf
}

export interface UrlTemporal {
  url: string;
  expiraEn: string; // ISO
}

export interface Almacenamiento {
  subirComprobante(buffer: Buffer, mime: string): Promise<ArchivoGuardado>;
  urlTemporal(archivoId: string, archivoTipo: string, baseUrl: string): Promise<UrlTemporal>;
  eliminar(archivoId: string, archivoTipo: string): Promise<void>;
}

export const URL_TTL_SEGUNDOS = 5 * 60;
export const CARPETA_CLOUDINARY = 'educar-para-transformar/comprobantes';
export const MSG_ALMACENAMIENTO_NO_CONFIGURADO = 'El almacenamiento de archivos no está configurado.';
export const MSG_TOKEN_ARCHIVO_INVALIDO = 'El enlace del archivo es inválido o venció. Pedí uno nuevo.';

export const EXTENSION_POR_MIME: Record<string, 'jpg' | 'png' | 'pdf'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

function extension(mime: string): 'jpg' | 'png' | 'pdf' {
  const ext = EXTENSION_POR_MIME[mime];
  if (!ext) throw HttpError.badRequest('El archivo debe ser una imagen JPG/PNG o un PDF.');
  return ext;
}

// ---- Selección del driver ----

const VALORES_SIN_CONFIGURAR = new Set(['', 'pendiente', 'cambiar']);

export function cloudinaryConfigurado(c: {
  CLOUDINARY_CLOUD_NAME?: string;
  CLOUDINARY_API_KEY?: string;
  CLOUDINARY_API_SECRET?: string;
}): boolean {
  return [c.CLOUDINARY_CLOUD_NAME, c.CLOUDINARY_API_KEY, c.CLOUDINARY_API_SECRET].every(
    (v) => v !== undefined && !VALORES_SIN_CONFIGURAR.has(v.trim().toLowerCase()),
  );
}

export interface EntornoAlmacenamiento {
  NODE_ENV: 'development' | 'production' | 'test';
  STORAGE_DRIVER?: string;
  CLOUDINARY_CLOUD_NAME?: string;
}

// Reglas:
// - STORAGE_DRIVER explícito ('cloudinary' | 'local') manda, salvo 'local' en
//   producción, que se ignora con un warning (Render no tiene disco
//   persistente y el archivo se perdería en el próximo deploy).
// - Sin STORAGE_DRIVER: test → memoria; producción → cloudinary; desarrollo →
//   cloudinary si CLOUDINARY_CLOUD_NAME está cargado, si no → local.
export function resolverDriver(e: EntornoAlmacenamiento): { driver: DriverAlmacenamiento; advertencia?: string } {
  const pedido = e.STORAGE_DRIVER?.trim().toLowerCase() || undefined;
  let advertencia: string | undefined;

  if (pedido === 'cloudinary') return { driver: 'cloudinary' };
  if (pedido === 'local') {
    if (e.NODE_ENV !== 'production') return { driver: 'local' };
    advertencia = 'STORAGE_DRIVER=local está prohibido en producción: se usa cloudinary.';
    return { driver: 'cloudinary', advertencia };
  }
  if (pedido !== undefined) {
    advertencia = `STORAGE_DRIVER="${pedido}" no es válido (cloudinary | local): se elige según el entorno.`;
  }

  const conCloudinary = !VALORES_SIN_CONFIGURAR.has((e.CLOUDINARY_CLOUD_NAME ?? '').trim().toLowerCase());
  let driver: DriverAlmacenamiento;
  if (e.NODE_ENV === 'test') driver = 'memoria';
  else if (e.NODE_ENV === 'production') driver = 'cloudinary';
  else driver = conCloudinary ? 'cloudinary' : 'local';
  return advertencia ? { driver, advertencia } : { driver };
}

// ---- Driver Cloudinary (producción) ----

// Cloudinary trata el PDF como resource_type 'image' (lo convierte por
// página), así que jpg, png y pdf van todos como 'image'. La descarga
// privada pasa por la API firmada de "download", que no depende de la
// opción de entrega pública de PDFs de la cuenta free.
const RESOURCE_TYPE = 'image' as const;

function configurarCloudinary() {
  if (!cloudinaryConfigurado(env)) throw new HttpError(503, MSG_ALMACENAMIENTO_NO_CONFIGURADO);
  cloudinary.config({
    cloud_name: env.CLOUDINARY_CLOUD_NAME,
    api_key: env.CLOUDINARY_API_KEY,
    api_secret: env.CLOUDINARY_API_SECRET,
  });
}

export const driverCloudinary: Almacenamiento = {
  async subirComprobante(buffer, mime) {
    extension(mime);
    configurarCloudinary();
    const publicId = await new Promise<string>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { type: 'private', folder: CARPETA_CLOUDINARY, resource_type: RESOURCE_TYPE },
        (err, result) => {
          if (err || !result) {
            logger.error('No se pudo subir el comprobante a Cloudinary', { message: err?.message });
            reject(new HttpError(502, 'No se pudo guardar el archivo. Probá de nuevo en unos minutos.'));
            return;
          }
          resolve(result.public_id);
        },
      );
      stream.end(buffer);
    });
    return { archivoId: publicId, archivoTipo: mime };
  },

  async urlTemporal(archivoId, archivoTipo) {
    configurarCloudinary();
    const expiraEn = Math.floor(Date.now() / 1000) + URL_TTL_SEGUNDOS;
    const url = cloudinary.utils.private_download_url(archivoId, extension(archivoTipo), {
      resource_type: RESOURCE_TYPE,
      type: 'private',
      expires_at: expiraEn,
    });
    return { url, expiraEn: new Date(expiraEn * 1000).toISOString() };
  },

  async eliminar(archivoId) {
    try {
      configurarCloudinary();
      await cloudinary.uploader.destroy(archivoId, { resource_type: RESOURCE_TYPE, type: 'private' });
    } catch (err) {
      logger.warn('No se pudo borrar el comprobante de Cloudinary', {
        archivoId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

// ---- Driver local (solo desarrollo) ----

export const DIR_LOCAL = path.resolve(__dirname, '..', '..', 'storage-privado', 'comprobantes');

// Nombre de archivo local: exactamente <uuid>.<ext>. Tres barreras contra
// path traversal antes de tocar el disco:
//   1. el nombre sale SOLO de path.basename (descarta cualquier directorio) y
//      tiene que coincidir con lo recibido (si traía "../" o "sub/", se rechaza);
//   2. regex estricta: uuid en minúsculas + extensión permitida, nada más;
//   3. la ruta resuelta tiene que quedar dentro de DIR_LOCAL.
const ARCHIVO_LOCAL_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(?:jpg|png|pdf)$/;

export function validarArchivoIdLocal(archivoId: string): string {
  const nombre = path.basename(archivoId);
  if (nombre !== archivoId || !ARCHIVO_LOCAL_RE.test(nombre)) {
    throw HttpError.forbidden(MSG_TOKEN_ARCHIVO_INVALIDO);
  }
  const ruta = path.resolve(DIR_LOCAL, nombre);
  if (!ruta.startsWith(DIR_LOCAL + path.sep)) throw HttpError.forbidden(MSG_TOKEN_ARCHIVO_INVALIDO);
  return nombre;
}

// El token se firma con una clave derivada de JWT_ACCESS_SECRET (HMAC con
// un contexto propio) y no con el secreto tal cual: así un token de archivo
// nunca verifica como access token en requireAuth, ni al revés.
const claveTokenArchivo = () =>
  createHmac('sha256', env.JWT_ACCESS_SECRET).update('archivos-comprobantes').digest('hex');

interface TokenArchivo {
  archivoId: string;
  tipo: string;
}

export function firmarTokenArchivo(archivoId: string, tipo: string, ttlSegundos = URL_TTL_SEGUNDOS): string {
  return jwt.sign({ archivoId, tipo } satisfies TokenArchivo, claveTokenArchivo(), { expiresIn: ttlSegundos });
}

export function verificarTokenArchivo(token: string): TokenArchivo {
  try {
    const payload = jwt.verify(token, claveTokenArchivo()) as Partial<TokenArchivo>;
    if (typeof payload.archivoId !== 'string' || typeof payload.tipo !== 'string') throw new Error('payload');
    validarArchivoIdLocal(payload.archivoId);
    extension(payload.tipo);
    return { archivoId: payload.archivoId, tipo: payload.tipo };
  } catch {
    throw HttpError.forbidden(MSG_TOKEN_ARCHIVO_INVALIDO);
  }
}

// GET /api/pagos/archivos/:token (solo con el driver local). Devuelve el
// nombre ya validado (relativo a DIR_LOCAL) y el mime; la ruta lo sirve con
// res.sendFile(nombre, { root: DIR_LOCAL, dotfiles: 'deny' }), que además
// vuelve a impedir salir de DIR_LOCAL. Nunca se lee el archivo acá.
export function resolverArchivoLocal(token: string): { nombre: string; tipo: string } {
  const { archivoId, tipo } = verificarTokenArchivo(token);
  return { nombre: validarArchivoIdLocal(archivoId), tipo };
}

export const driverLocal: Almacenamiento = {
  async subirComprobante(buffer, mime) {
    const archivoId = `${randomUUID()}.${extension(mime)}`;
    await fs.mkdir(DIR_LOCAL, { recursive: true });
    await fs.writeFile(path.resolve(DIR_LOCAL, validarArchivoIdLocal(archivoId)), buffer);
    return { archivoId, archivoTipo: mime };
  },

  async urlTemporal(archivoId, archivoTipo, baseUrl) {
    validarArchivoIdLocal(archivoId);
    const token = firmarTokenArchivo(archivoId, archivoTipo);
    const expiraEn = new Date(Date.now() + URL_TTL_SEGUNDOS * 1000).toISOString();
    return { url: `${sinBarrasFinales(baseUrl)}/api/pagos/archivos/${token}`, expiraEn };
  },

  async eliminar(archivoId) {
    try {
      await fs.unlink(path.resolve(DIR_LOCAL, validarArchivoIdLocal(archivoId)));
    } catch (err) {
      logger.warn('No se pudo borrar el comprobante local', {
        archivoId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  },
};

// ---- Driver en memoria (NODE_ENV=test) ----

// No toca la red ni el disco. El id es determinístico (hash del contenido).
export const archivosEnMemoria = new Map<string, { buffer: Buffer; mime: string }>();

export const driverMemoria: Almacenamiento = {
  async subirComprobante(buffer, mime) {
    const archivoId = `memoria/${createHash('sha256').update(buffer).digest('hex').slice(0, 16)}.${extension(mime)}`;
    archivosEnMemoria.set(archivoId, { buffer, mime });
    return { archivoId, archivoTipo: mime };
  },
  async urlTemporal(archivoId, _archivoTipo, baseUrl) {
    const expiraEn = new Date(Date.now() + URL_TTL_SEGUNDOS * 1000).toISOString();
    return { url: `${sinBarrasFinales(baseUrl)}/memoria/${encodeURIComponent(archivoId)}`, expiraEn };
  },
  async eliminar(archivoId) {
    archivosEnMemoria.delete(archivoId);
  },
};

// ---- Punto de entrada ----

const DRIVERS: Record<DriverAlmacenamiento, Almacenamiento> = {
  cloudinary: driverCloudinary,
  local: driverLocal,
  memoria: driverMemoria,
};

let driverActivo: DriverAlmacenamiento | undefined;

export function driverActual(): DriverAlmacenamiento {
  if (!driverActivo) {
    const { driver, advertencia } = resolverDriver(env);
    if (advertencia) logger.warn(advertencia);
    driverActivo = driver;
  }
  return driverActivo;
}

// Objeto único que usan los servicios. Sus métodos se pueden reemplazar en
// los tests (mock.method) sin tocar los drivers.
export const almacenamiento: Almacenamiento & { driver: () => DriverAlmacenamiento } = {
  driver: driverActual,
  subirComprobante: (buffer, mime) => DRIVERS[driverActual()].subirComprobante(buffer, mime),
  urlTemporal: (archivoId, archivoTipo, baseUrl) =>
    DRIVERS[driverActual()].urlTemporal(archivoId, archivoTipo, baseUrl),
  eliminar: async (archivoId, archivoTipo) => {
    try {
      await DRIVERS[driverActual()].eliminar(archivoId, archivoTipo);
    } catch {
      // best-effort: nunca lanza
    }
  },
};
