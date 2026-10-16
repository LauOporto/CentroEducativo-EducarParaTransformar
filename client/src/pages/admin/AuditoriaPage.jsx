import { useEffect, useState } from 'react';
import { auditoriaService } from '../../services/api/auditoriaService';
import DataTable from '../../components/ui/DataTable';

const ENTIDADES = [
  { value: '', label: 'Todas' },
  { value: 'User', label: 'Alumnos y profesores' },
  { value: 'DocentePendiente', label: 'Aprobación de docentes' },
  { value: 'InscripcionDeporte', label: 'Inscripciones a deportes' },
  { value: 'InscripcionTransporte', label: 'Inscripciones a transporte' },
  { value: 'InscripcionComedor', label: 'Inscripciones a comedor' },
  { value: 'Inscription', label: 'Solicitudes de inscripción' },
  { value: 'Opinion', label: 'Opiniones' },
  { value: 'EmploymentApplication', label: 'Postulaciones de empleo' },
  { value: 'GaleriaImagen', label: 'Galería' },
];

const ACCION_LABEL = { ALTA: 'Alta', MODIFICACION: 'Modificación', BAJA: 'Baja' };

function formatFecha(iso) {
  return new Date(iso).toLocaleString('es-AR');
}

export default function AuditoriaPage() {
  const [entidad, setEntidad] = useState('');
  const [registros, setRegistros] = useState(null);

  useEffect(() => {
    auditoriaService.list(entidad).then((data) => setRegistros(data.exito ? data.registros : []));
  }, [entidad]);

  const columns = [
    { key: 'createdAt', label: 'Fecha y hora', render: (r) => formatFecha(r.createdAt) },
    { key: 'usuario', label: 'Usuario' },
    { key: 'accion', label: 'Acción', render: (r) => ACCION_LABEL[r.accion] ?? r.accion },
    { key: 'entidad', label: 'Entidad' },
    { key: 'entidadId', label: 'ID' },
    { key: 'detalle', label: 'Detalle', render: (r) => r.detalle || '—' },
  ];

  return (
    <div>
      <h3 className="mb-4 border-b border-blue-100 pb-3 text-xl font-bold dark:border-slate-700">Log de Auditoría</h3>
      <p className="mb-4 text-sm text-ink-faint">
        Quién hizo cada alta, modificación o baja sobre alumnos, profesores e inscripciones.
      </p>
      <select
        value={entidad} onChange={(e) => setEntidad(e.target.value)}
        className="mb-4 rounded border border-blue-200 p-2 text-sm dark:border-slate-600 dark:bg-slate-900"
      >
        {ENTIDADES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <DataTable columns={columns} rows={registros ?? []} loading={registros === null} emptyMessage="Sin registros." />
    </div>
  );
}
