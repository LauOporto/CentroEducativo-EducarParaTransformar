import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { attendanceService } from '../../services/api/attendanceService';
import AttendanceSummary from '../../components/features/AttendanceSummary';

export default function AsistenciasPage() {
  const { hijoId } = useOutletContext();
  const [rows, setRows] = useState(null);

  useEffect(() => {
    if (!hijoId) {
      setRows([]);
      return;
    }
    setRows(null);
    attendanceService.listByStudent(hijoId).then((data) => setRows(data.exito ? data.asistencias : []));
  }, [hijoId]);

  return (
    <div>
      <h3 className="mb-5 border-b border-slate-200 pb-3 text-xl font-bold dark:border-slate-700">Asistencias del hijo</h3>
      {!hijoId ? (
        <p className="text-center text-slate-400">Seleccioná o vinculá un hijo primero.</p>
      ) : (
        <AttendanceSummary rows={rows} loading={rows === null} />
      )}
    </div>
  );
}
