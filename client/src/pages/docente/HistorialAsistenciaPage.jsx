import { useEffect, useState } from 'react';
import { attendanceService } from '../../services/api/attendanceService';
import { studentsService } from '../../services/api/studentsService';
import DataTable from '../../components/ui/DataTable';

const ESTADO_LABEL = { PRESENTE: 'Presente', AUSENTE: 'Ausente', TARDE: 'Tarde', JUSTIFICADO: 'Justificado' };

export default function HistorialAsistenciaPage() {
  const [estudiantes, setEstudiantes] = useState([]);
  const [estudianteId, setEstudianteId] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [registros, setRegistros] = useState(null);

  useEffect(() => {
    studentsService.list().then((data) => setEstudiantes(data.exito ? data.estudiantes : []));
  }, []);

  const buscar = async (e) => {
    e.preventDefault();
    if (!estudianteId) return;
    const data = await attendanceService.listByStudent(estudianteId, { desde, hasta });
    setRegistros(data.exito ? data.asistencias : []);
  };

  const columns = [
    { key: 'fecha', label: 'Fecha' },
    { key: 'materia', label: 'Materia', render: (r) => r.materia || '—' },
    { key: 'status', label: 'Estado', render: (r) => ESTADO_LABEL[r.status] ?? r.status },
    { key: 'observacion', label: 'Observación', render: (r) => r.observacion || '—' },
  ];

  return (
    <div>
      <h3 className="mb-5 border-b border-blue-100 pb-3 text-xl font-bold dark:border-slate-700">Historial de Asistencia</h3>

      <form onSubmit={buscar} className="mb-5 flex flex-wrap items-end gap-2">
        <select
          required value={estudianteId} onChange={(e) => setEstudianteId(e.target.value)}
          className="min-w-[240px] flex-1 rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        >
          <option value="">Elegir alumno…</option>
          {estudiantes.map((al) => (
            <option key={al.id} value={al.id}>{al.nombre} — {al.curso || 'sin curso'}</option>
          ))}
        </select>
        <label className="flex flex-col gap-1 text-xs text-ink-faint">
          Desde
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className="rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        </label>
        <label className="flex flex-col gap-1 text-xs text-ink-faint">
          Hasta
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className="rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900" />
        </label>
        <button type="submit" className="rounded bg-accent px-4 py-2 text-sm font-semibold text-white">
          <i className="fas fa-search" /> Buscar
        </button>
      </form>

      <DataTable columns={columns} rows={registros ?? []} loading={estudianteId !== '' && registros === null} emptyMessage="Elegí un alumno para ver su historial." />
    </div>
  );
}
