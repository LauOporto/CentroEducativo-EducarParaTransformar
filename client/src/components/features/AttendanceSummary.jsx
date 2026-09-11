import DataTable from '../ui/DataTable';

const COLORS = {
  PRESENTE: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', fg: 'text-emerald-700 dark:text-emerald-300', label: 'Presente' },
  AUSENTE: { bg: 'bg-red-100 dark:bg-red-900/40', fg: 'text-red-700 dark:text-red-300', label: 'Ausente' },
  TARDE: { bg: 'bg-amber-100 dark:bg-amber-900/40', fg: 'text-amber-700 dark:text-amber-300', label: 'Tarde' },
  JUSTIFICADO: { bg: 'bg-blue-100 dark:bg-blue-900/40', fg: 'text-blue-700 dark:text-blue-300', label: 'Justificada' },
};

function formatFecha(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const columns = [
  { key: 'fecha', label: 'Fecha', render: (r) => formatFecha(r.fecha) },
  {
    key: 'dia',
    label: 'Día',
    render: (r) => new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long' }),
  },
  {
    key: 'status',
    label: 'Estado',
    render: (r) => (
      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${COLORS[r.status].bg} ${COLORS[r.status].fg}`}>
        {COLORS[r.status].label}
      </span>
    ),
  },
  { key: 'observacion', label: 'Observación', render: (r) => r.observacion || '—' },
];

export default function AttendanceSummary({ rows, loading }) {
  const cont = { PRESENTE: 0, AUSENTE: 0, TARDE: 0, JUSTIFICADO: 0 };
  (rows ?? []).forEach((r) => (cont[r.status] = (cont[r.status] || 0) + 1));
  const total = rows?.length ?? 0;
  const pct = total ? Math.round((cont.PRESENTE / total) * 100) : 0;

  const tiles = [
    { label: '% PRESENCIAS', value: `${pct}%`, cls: 'text-emerald-600' },
    { label: 'AUSENCIAS', value: cont.AUSENTE, cls: 'text-red-600' },
    { label: 'TARDES', value: cont.TARDE, cls: 'text-amber-600' },
    { label: 'JUSTIFICADAS', value: cont.JUSTIFICADO, cls: 'text-blue-600' },
  ];

  return (
    <div>
      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-lg border border-slate-200 p-3.5 dark:border-slate-700">
            <div className="text-xs font-semibold text-slate-500">{t.label}</div>
            <div className={`text-2xl font-bold ${t.cls}`}>{t.value}</div>
          </div>
        ))}
      </div>
      <DataTable columns={columns} rows={rows ?? []} loading={loading} emptyMessage="No hay asistencias registradas." />
    </div>
  );
}
