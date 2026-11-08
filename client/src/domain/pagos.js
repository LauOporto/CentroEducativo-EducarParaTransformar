// Formatos y constantes compartidas por el panel de pagos del administrador.

const fmtMonto = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 });

// 292000 → "$ 292.000,00" (los montos llegan del backend como number).
export function formatearMonto(valor) {
  if (valor === null || valor === undefined || valor === '') return '—';
  return fmtMonto.format(Number(valor)).replace(/\s/g, ' ');
}

// "2026-11-05" (o un ISO que lo empiece) → "05/11/2026". Se corta el texto:
// con new Date() la zona horaria podría correr el día.
export function formatearFecha(texto) {
  if (!texto) return '—';
  const [y, m, d] = String(texto).slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : '—';
}

// Fecha de hoy (YYYY-MM-DD) en la zona del negocio.
export function hoyAR() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

// "AAAA-MM" del mes actual y del siguiente (zona del negocio).
export function periodosDisponibles() {
  const [y, m] = hoyAR().split('-').map(Number);
  const sig = m === 12 ? [y + 1, 1] : [y, m + 1];
  const f = ([a, b]) => `${a}-${String(b).padStart(2, '0')}`;
  return [f([y, m]), f(sig)];
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];
export function etiquetaPeriodo(periodo) {
  const [y, m] = String(periodo).split('-');
  return MESES[Number(m) - 1] ? `${MESES[Number(m) - 1]} de ${y}` : periodo;
}

export const ESTADOS_COMPROBANTE = [
  { value: 'EN_REVISION', label: 'En revisión' },
  { value: 'APROBADO', label: 'Aprobado' },
  { value: 'RECHAZADO', label: 'Rechazado' },
  { value: 'GENERADO', label: 'Generado' },
  { value: 'ANULADO', label: 'Anulado' },
];

export const ESTADO_ESTILO = {
  GENERADO: { label: 'Generado', cls: 'bg-slate-100 text-slate-700' },
  PENDIENTE: { label: 'Pendiente', cls: 'bg-slate-100 text-slate-700' },
  ANULADO: { label: 'Anulado', cls: 'bg-slate-100 text-slate-700' },
  EN_REVISION: { label: 'En revisión', cls: 'bg-blue-100 text-blue-700' },
  APROBADO: { label: 'Aprobado', cls: 'bg-teal/15 text-teal-800' },
  RECHAZADO: { label: 'Rechazado', cls: 'bg-coral/15 text-coral-800' },
};

// Precio válido: número ≥ 0, ≤ 10.000.000 y hasta 2 decimales.
export function precioValido(texto) {
  const t = String(texto ?? '')
    .trim()
    .replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return false;
  const n = Number(t);
  return n >= 0 && n <= 10_000_000;
}
