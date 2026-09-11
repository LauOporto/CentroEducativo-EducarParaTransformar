import { useEffect, useState } from 'react';
import { gradesService } from '../../services/api/gradesService';
import { useAuth } from '../../hooks/useAuth';
import DataTable from '../../components/ui/DataTable';

const columns = [
  { key: 'materia', label: 'Materia' },
  { key: 'instancia_evaluacion', label: 'Instancia de evaluación' },
  { key: 'nota', label: 'Calificación', render: (r) => <b>{r.nota}</b> },
  { key: 'fecha', label: 'Fecha de registro' },
];

export default function BoletinPage() {
  const { user } = useAuth();
  const [notas, setNotas] = useState(null);

  useEffect(() => {
    gradesService.listByStudent(user.id).then((data) => setNotas(data.exito ? data.notas : []));
  }, [user.id]);

  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">
        Mi Boletín de Calificaciones (solo lectura)
      </h3>
      <DataTable
        columns={columns}
        rows={notas ?? []}
        loading={notas === null}
        emptyMessage="No hay calificaciones registradas por el cuerpo docente."
      />
    </div>
  );
}
