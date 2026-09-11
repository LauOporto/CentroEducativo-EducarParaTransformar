import { useEffect, useState } from 'react';
import { adminService } from '../../services/api/adminService';

const TILES = [
  { key: 'totalUsuarios', label: 'Usuarios totales', cls: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40' },
  { key: 'estudiantesActivos', label: 'Estudiantes activos', cls: 'text-blue-600 bg-blue-50 dark:bg-blue-950/40' },
  { key: 'docentesActivos', label: 'Docentes activos', cls: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40' },
  { key: 'padresActivos', label: 'Padres activos', cls: 'text-pink-600 bg-pink-50 dark:bg-pink-950/40' },
  { key: 'notasRegistradas', label: 'Notas registradas', cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40' },
  { key: 'temasForo', label: 'Temas del foro', cls: 'text-violet-600 bg-violet-50 dark:bg-violet-950/40' },
];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    adminService.stats().then((data) => data.exito && setStats(data.stats));
  }, []);

  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Dashboard institucional</h3>
      <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
        {TILES.map((t) => (
          <div key={t.key} className={`rounded-xl p-4 ${t.cls}`}>
            <div className="text-xs font-semibold uppercase">{t.label}</div>
            <div className="mt-1 text-2xl font-bold">{stats ? Number(stats[t.key]).toLocaleString('es-AR') : '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
