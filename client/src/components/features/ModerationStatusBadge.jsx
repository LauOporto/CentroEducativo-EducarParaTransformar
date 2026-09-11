const STYLES = {
  PENDIENTE: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  APROBADO: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  RECHAZADO: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const LABELS = { PENDIENTE: 'Pendiente', APROBADO: 'Aprobado', RECHAZADO: 'Rechazado' };

export default function ModerationStatusBadge({ status }) {
  return <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STYLES[status]}`}>{LABELS[status]}</span>;
}
