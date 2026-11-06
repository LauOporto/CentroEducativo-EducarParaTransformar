import { aCentavos } from './seleccion';
import { pesos } from './formato';
import type { TipoArchivo } from './api';

// Validaciones locales del formulario "Cargar transferencia" (RF-50). Son
// las mismas reglas que aplica cargarTransferencia en el backend, para
// avisar antes de subir el archivo; el backend vuelve a validar todo.

const NRO_OPERACION_RE = /^[A-Za-z0-9-]{4,40}$/;
export const DIAS_MAX_ANTIGUEDAD = 60;
export const MAX_ARCHIVO_MB = 5;
export const MAX_ARCHIVO_BYTES = MAX_ARCHIVO_MB * 1024 * 1024;

export function validarNroOperacion(nro: string): string | null {
  return NRO_OPERACION_RE.test(nro.trim())
    ? null
    : 'El N.º de operación tiene que tener entre 4 y 40 caracteres: solo letras, números y guiones.';
}

/** Mientras se escribe: "10112026" → "10/11/2026". */
export function mascaraFecha(texto: string): string {
  const d = texto.replace(/\D/g, '').slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "AAAA-MM-DD" → "DD/MM/AAAA" */
export const aDMA = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

/** "DD/MM/AAAA" → "AAAA-MM-DD", o null si no es una fecha real. */
export function desdeDMA(texto: string): string | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto.trim());
  if (!m) return null;
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const d = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : null;
}

export function sumarDias(iso: string, dias: number): string {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function validarFecha(texto: string, hoy: string): { fecha: string } | { error: string } {
  const fecha = desdeDMA(texto);
  if (!fecha) return { error: 'Ingresá la fecha como DD/MM/AAAA (por ejemplo, 05/11/2026).' };
  if (fecha > hoy) return { error: 'La fecha de la transferencia no puede ser futura.' };
  if (fecha < sumarDias(hoy, -DIAS_MAX_ANTIGUEDAD)) {
    return { error: `La fecha de la transferencia no puede tener más de ${DIAS_MAX_ANTIGUEDAD} días.` };
  }
  return { fecha };
}

/** Monto como lo escribe la gente: "290000", "290000,50", "290.000,50" o "$ 290.000". En centavos. */
export function centavosDeTexto(texto: string): number | null {
  let t = texto.replace(/[\s$ ]/g, '');
  if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
  else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
  if (!/^\d{1,10}(\.\d{1,2})?$/.test(t)) return null;
  return aCentavos(Number(t));
}

/** Precarga del campo monto: el total exacto, con coma decimal ("290000,00"). */
export function montoParaCampo(total: number): string {
  const c = aCentavos(total);
  return `${Math.floor(c / 100)},${String(c % 100).padStart(2, '0')}`;
}

/** Monto para la API, con punto decimal ("290000.00"). */
function montoParaApi(centavos: number): string {
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, '0')}`;
}

export function validarMonto(texto: string, total: number): { monto: string } | { error: string } {
  const centavos = centavosDeTexto(texto);
  if (centavos === null) return { error: 'Ingresá un monto válido, por ejemplo 290000,00.' };
  if (centavos !== aCentavos(total)) return { error: `El monto tiene que ser exactamente ${pesos(total)}.` };
  return { monto: montoParaApi(centavos) };
}

const POR_EXTENSION: Record<string, TipoArchivo> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

const MIME_ADMITIDO: Record<string, TipoArchivo> = {
  'image/jpeg': 'image/jpeg',
  'image/jpg': 'image/jpeg',
  'image/png': 'image/png',
  'application/pdf': 'application/pdf',
};

/** Tipo admitido según el mime informado o, si falta, la extensión. null si no es JPG, PNG ni PDF. */
export function tipoDeArchivo(mime: string | null | undefined, nombre: string): TipoArchivo | null {
  if (mime) return MIME_ADMITIDO[mime.toLowerCase()] ?? null;
  const ext = nombre.split('?')[0]?.split('.').pop()?.toLowerCase() ?? '';
  return POR_EXTENSION[ext] ?? null;
}

export function validarTamano(bytes: number | undefined): string | null {
  return bytes !== undefined && bytes > MAX_ARCHIVO_BYTES
    ? `El archivo supera el máximo de ${MAX_ARCHIVO_MB} MB. Probá con una foto de menor calidad.`
    : null;
}

export function tamanoLegible(bytes: number | undefined): string {
  if (bytes === undefined) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export const MSG_TIPO_ARCHIVO = 'El archivo tiene que ser una imagen JPG o PNG, o un PDF.';
export const MSG_SIN_ARCHIVO = 'Adjuntá el comprobante de la transferencia (foto o PDF).';
