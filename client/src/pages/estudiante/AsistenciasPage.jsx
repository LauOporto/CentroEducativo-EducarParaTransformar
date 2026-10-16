import { useEffect, useState } from 'react';
import { attendanceService } from '../../services/api/attendanceService';
import { useAuth } from '../../hooks/useAuth';
import AttendanceSummary from '../../components/features/AttendanceSummary';

export default function AsistenciasPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    attendanceService.listByStudent(user.id).then((data) => setRows(data.exito ? data.asistencias : []));
  }, [user.id]);

  return (
    <div>
      <h3 className="mb-5 border-b border-blue-100 pb-3 text-xl font-bold dark:border-slate-700">Mi Registro de Asistencias</h3>
      <AttendanceSummary rows={rows} loading={rows === null} />
    </div>
  );
}
